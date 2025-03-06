export type Message = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

export type ModelParameters = {
  temperature?: number;
  top_p?: number;
  top_k?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  max_tokens?: number;
  stop?: string[];
  repeat_penalty?: number;
  [key: string]: any; // Allow for provider-specific parameters.
};

export type CompletionOptions = {
  model: string;
  messages: Message[];
  stream?: boolean;
  parameters?: ModelParameters;
};

export type CompletionChunk = {
  message: {
    content: string;
    role: string;
  };
  done: boolean;
};

export type ModelInfo = {
  name: string;
  size?: string;
  parameters?: number;
  quantization?: string;
  family?: string;
  details?: Record<string, any>;
};

export type ProviderConfig = {
  baseUrl: string;
  headers?: Record<string, string>;
  transformRequest?: (options: CompletionOptions) => any;
  transformResponse?: (data: any) => any;
  streamTransform?: (data: any) => CompletionChunk;
  listTransform?: (data: any) => ModelInfo[];
  apiPath: string;
  listPath: string;
};

// Pre-configured provider settings
const PROVIDER_CONFIGS: Record<string, ProviderConfig> = {
  ollama: {
    baseUrl: 'http://localhost:11434',
    apiPath: '/api/chat',
    listPath: '/api/tags',
    transformRequest: (options) => ({
      model: options.model,
      messages: options.messages,
      stream: options.stream,
      options: options.parameters
    }),
    streamTransform: (data) => ({
      message: {
        content: data.message?.content || '',
        role: data.message?.role || 'assistant'
      },
      done: data.done || false
    }),
    listTransform: (data) => {
      return (data.models || []).map((model: any) => ({
        name: model.name,
        size: model.size || undefined,
        family: model.family || undefined,
        details: model
      }));
    }
  },
  koboldcpp: {
    baseUrl: 'http://localhost:5001',
    apiPath: '/api/v1/generate',
    listPath: '/api/v1/model',
    transformRequest: (options) => {
      // Convert messages to a prompt format KoboldCPP understands.
      const prompt = options.messages.map(msg => {
        if (msg.role === 'user') return `User: ${msg.content}\n`;
        if (msg.role === 'assistant') return `Assistant: ${msg.content}\n`;
        if (msg.role === 'system') return `System: ${msg.content}\n`;
        return `${msg.content}\n`;
      }).join('');
      
      return {
        prompt,
        max_length: options.parameters?.max_tokens || 2048,
        temperature: options.parameters?.temperature || 0.7,
        top_p: options.parameters?.top_p || 0.9,
        top_k: options.parameters?.top_k || 40,
        rep_pen: options.parameters?.repeat_penalty || 1.1,
        stream: options.stream
      };
    },
    transformResponse: (data) => ({
      message: {
        content: data.results?.[0]?.text || '',
        role: 'assistant'
      }
    }),
    streamTransform: (data) => ({
      message: {
        content: data.token || '',
        role: 'assistant'
      },
      done: data.done || false
    }),
    listTransform: (data) => {
      // KoboldCPP typically only has one active model.
      if (data.result === "ok" && data.model) {
        return [{
          name: data.model,
          details: data
        }];
      }
      return [];
    }
  }
};

export class LLMClient {
  private config: ProviderConfig;
  
  /**
   * Create an LLM client for a specific provider or with custom configuration
   */
  constructor(provider: string | ProviderConfig) {
    if (typeof provider === 'string') {
      const config = PROVIDER_CONFIGS[provider.toLowerCase()];
      if (!config) {
        throw new Error(`Provider "${provider}" is not supported. Available providers: ${Object.keys(PROVIDER_CONFIGS).join(', ')}`);
      }
      this.config = { ...config };
    } else {
      this.config = provider;
    }
  }

  /**
   * Set a custom base URL for the API
   */
  setBaseUrl(url: string): this {
    this.config.baseUrl = url;
    return this;
  }

  /**
   * Add or update custom headers for requests
   */
  setHeaders(headers: Record<string, string>): this {
    this.config.headers = { ...this.config.headers, ...headers };
    return this;
  }

  /**
   * Check if the service is running by attempting to list models
   * @returns Promise<boolean> true if service is reachable
   */
  async isRunning(timeout = 5000): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(`${this.config.baseUrl}${this.config.listPath}`, {
        signal: controller.signal,
        headers: this.config.headers
      });
      
      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * List available models from the provider
   * @returns Promise<ModelInfo[]> Array of available models
   */
  async listModels(): Promise<ModelInfo[]> {
    try {
      const response = await fetch(`${this.config.baseUrl}${this.config.listPath}`, {
        headers: this.config.headers
      });

      if (!response.ok) {
        throw new Error(`Failed to list models: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Transform the response based on provider
      if (this.config.listTransform) {
        return this.config.listTransform(data);
      }
      
      // Generic fallback
      return Array.isArray(data.models) 
        ? data.models.map((m: any) => ({ name: m.name || m.id || m, details: m }))
        : [];
    } catch (error) {
      console.error("Error listing models:", error);
      throw error;
    }
  }

  /**
   * Send a chat completion request
   */
  async chat(options: CompletionOptions): Promise<any | AsyncIterable<CompletionChunk>> {
    const endpoint = `${this.config.baseUrl}${this.config.apiPath}`;
    
    let requestBody = options;
    if (this.config.transformRequest) {
      requestBody = this.config.transformRequest(options);
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.config.headers
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }

      if (options.stream) {
        return this._handleStreamResponse(response);
      } else {
        const data = await response.json();
        return this.config.transformResponse ? this.config.transformResponse(data) : data;
      }
    } catch (error) {
      console.error("LLM request failed:", error);
      throw error;
    }
  }

  /**
   * Process streaming response into an async iterable
   */
  private async *_handleStreamResponse(response: Response): AsyncIterable<CompletionChunk> {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }
        
        buffer += decoder.decode(value, { stream: true });
        
        // Split by newlines and process each complete JSON object
        const lines = buffer.split('\n');
        buffer = lines.pop() || ""; // Keep the last potentially incomplete line
        
        for (const line of lines) {
          if (line.trim() === '') continue;
          
          try {
            const parsedLine = JSON.parse(line);
            const chunk = this.config.streamTransform ? 
              this.config.streamTransform(parsedLine) : parsedLine;
            
            yield chunk;
          } catch (e) {
            console.warn('Error parsing JSON from stream:', e);
          }
        }
      }
      
      // Handle any remaining data in the buffer
      if (buffer.trim()) {
        try {
          const parsedLine = JSON.parse(buffer);
          const chunk = this.config.streamTransform ? 
            this.config.streamTransform(parsedLine) : parsedLine;
          
          yield chunk;
        } catch (e) {
          console.warn('Error parsing remaining JSON from stream:', e);
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Add a new provider configuration
   */
  static addProvider(name: string, config: ProviderConfig): void {
    PROVIDER_CONFIGS[name.toLowerCase()] = config;
  }
}

// TODO: Export predefined providers for convenience, might replace it with a better solution.
export const PROVIDERS = {
  OLLAMA: 'ollama',
  KOBOLD_CPP: 'koboldcpp'
};