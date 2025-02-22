<script>
import ollama from "ollama";

export default {
  data() {
    return {
      chatOpen: false,
      userInput: "",
      messages: [],
      selectedModel: localStorage.getItem("selectedModel") || "defaultModel",
    };
  },
  methods: {
    toggleChat() {
      this.chatOpen = !this.chatOpen;
    },

    async sendMessage() {
      if (this.userInput.trim()) {
        const userMessage = { sender: 'User', content: this.userInput };
        this.messages.push(userMessage);
        this.userInput = "";

        const aiMessage = { sender: 'AI', content: this.selectedModel + " is thinking...", timeTaken: null };
        this.messages.push(aiMessage);

        await this.getStreamingResponse(userMessage.content);
      }
    },

    async getStreamingResponse(input) {
      const message = { role: 'user', content: input };

      console.log("Message sent to Ollama:", message);

      const options = {
        model: this.selectedModel,
        messages: [message],
        stream: true,
      };

      try {
        const startTime = Date.now();

        const response = await ollama.chat(options);

        let messageContent = "";
        for await (const part of response) {
          messageContent += part.message.content;
          this.updateMessage(messageContent);
        }

        const endTime = Date.now();
        const timeTaken = ((endTime - startTime) / 1000).toFixed(2);

        messageContent += `<br><small class="text-gray-400">took ${timeTaken} seconds</small>`;
        this.updateMessage(messageContent);
      } catch (error) {
        console.error("Error streaming response:", error);
        this.messages.push({ sender: 'Error', content: "Error: Unable to get a response from Ollama." });
      }
    },

    updateMessage(content) {
      const lastMessageIndex = this.messages.length - 1;
      this.messages[lastMessageIndex].content = content;
    }
  },
};
</script>

<template>
  <div class="relative">
    <!-- Chat Button -->
    <button
        @click="toggleChat"
        class="fixed right-8 bg-neutral-700 p-3 rounded-xl"
        :style="{ bottom: `calc(4rem + 1rem)` }"
    >
      <i class="fas fa-comments"></i>
    </button>

    <!-- Chat Panel -->
    <transition name="slide">
      <div
          v-if="chatOpen"
          class="absolute top-0 right-0 h-full w-80 bg-neutral-700 p-4 rounded-l-lg shadow-lg overflow-y-auto"
      >
        <div class="flex justify-between items-center">
          <span>AI Chat</span>
          <button @click="toggleChat" class="text-red-700">&times;</button>
        </div>
        <div class="chat-container bg-neutral-800 rounded-xl p-4 my-4">
            <div class="messages-container mb-4">
              <transition-group name="message-fade" tag="div">
                <div v-for="(message, index) in messages" :key="index" class="message-container mb-4">
                  <div v-if="message.sender === 'Error'" class="ai-message bg-red-800 p-3 rounded-lg shadow-lg">
                    <p v-html="message.content"></p>
                  </div>
                  <div v-else-if="message.sender === 'AI'" class="ai-message bg-neutral-900 p-3 rounded-lg shadow-lg">
                    <p v-html="message.content"></p>
                    <small v-if="message.timeTaken" class="text-gray-400 block mt-2">Took {{ message.timeTaken }} seconds to reply</small>
                  </div>
                  <div v-else class="user-message bg-neutral-700 p-3 rounded-lg text-white">
                    <p>{{ message.content }}</p>
                  </div>
                </div>
              </transition-group>
            </div>
          <input
              v-model="userInput"
              type="text"
              placeholder="Ask a question..."
              class="p-2 bg-neutral-700 text-white rounded-md w-full mb-4"
          />

          <button @click="sendMessage" class="p-2 bg-neutral-900 text-white rounded-md">Send</button>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.slide-enter-active,
.slide-leave-active {
  transition: transform 0.3s ease-in-out;
}
.slide-enter-from {
  transform: translateX(100%);
}
.slide-leave-to {
  transform: translateX(100%);
}

.message-fade-enter-active,
.message-fade-leave-active {
  transition: opacity 0.5s ease-in-out, transform 0.5s ease-in-out;
}

.message-fade-enter, .message-fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>
