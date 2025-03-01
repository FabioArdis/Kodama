use std::process::{Command, Stdio};
use std::path::Path;
use std::io::{BufReader, BufRead};
use std::thread;
use std::sync::{Arc, Mutex};
use tauri::{State, Emitter};
use std::fs;
use std::time::Instant;
use regex::Regex;
use serde::{Serialize, Deserialize};
use rayon::prelude::*;
use walkdir::WalkDir;
use ignore::WalkBuilder;

#[tauri::command]
fn greet(name: &str) -> String {
  format!("Hello, {}! You've been greeted from Rust!", name)
}
#[tauri::command]
async fn create_window(app: tauri::AppHandle, label: String) {
  let url = tauri::WebviewUrl::App(format!("{}.html", label).into());
  let _new_window = tauri::WebviewWindowBuilder::new(&app, &label.clone(), url)
    .title(label)
    .build()
    .unwrap();
}

#[derive(Serialize, Deserialize)]
struct SearchOptions {
  case_sensitive: bool,
  whole_word: bool,
  use_regex: bool,
  exclude_patterns: Vec<String>,
  include_ignored: bool,
}

#[derive(Serialize)]
struct Match {
  line_number: usize,
  line_content: String,
  match_index: usize,
}

#[derive(Serialize)]
struct FileMatch {
  file_path: String,
  matches: Vec<Match>,
}

#[derive(Serialize)]
struct SearchResults {
  matches: Vec<FileMatch>,
  files_searched: usize,
  total_matches: usize,
}

#[tauri::command]
fn search_in_project(project_path: String, search_term: String, options: SearchOptions) -> Result<SearchResults, String> {
  let start = Instant::now();
  let mut results = Vec::new();
  let files_searched;
  let mut total_matches = 0;
  
  // Prepare regex for search
  let regex = if options.use_regex {
    Regex::new(&search_term).map_err(|e| e.to_string())?
  } else if options.whole_word {
    let pattern = format!(r"\b{}\b", regex::escape(&search_term));
    if options.case_sensitive {
      Regex::new(&pattern).map_err(|e| e.to_string())?
    } else {
      Regex::new(&format!("(?i){}", pattern)).map_err(|e| e.to_string())?
    }
  } else if !options.case_sensitive {
    Regex::new(&format!("(?i){}", regex::escape(&search_term))).map_err(|e| e.to_string())?
  } else {
    Regex::new(&regex::escape(&search_term)).map_err(|e| e.to_string())?
  };
  
  // Function to check if a path should be excluded
  let should_exclude = |path: &Path| {
    for pattern in &options.exclude_patterns {
      if path.to_string_lossy().contains(pattern) {
        return true;
      }
    }
    false
  };
  
  // Choose between walkdir and ignore based on options
  let walker = if options.include_ignored {
    // Use walkdir which doesn't respect .gitignore
    let entries: Vec<_> = WalkDir::new(&project_path)
      .into_iter()
      .filter_map(|e| e.ok())
      .filter(|e| !should_exclude(e.path()))
      .filter(|e| e.file_type().is_file())
      .collect();
        
    files_searched = entries.len();
    
    // Process files in parallel for maximum speed
    let file_matches: Vec<_> = entries.par_iter()
      .filter_map(|entry| {
          process_file(entry.path(), &regex, &project_path)
      })
      .collect();
        
    file_matches
  } else {
    // Use ignore which respects .gitignore
    let entries: Vec<_> = WalkBuilder::new(&project_path)
      .hidden(false)
      .git_ignore(true)
      .build()
      .filter_map(|e| e.ok())
      .filter(|e| !should_exclude(e.path()))
      .filter(|e| e.file_type().map_or(false, |ft| ft.is_file()))
      .collect();
        
    files_searched = entries.len();
    
    // Process files in parallel
    let file_matches: Vec<_> = entries.par_iter()
      .filter_map(|entry| {
        process_file(entry.path(), &regex, &project_path)
      })
      .collect();
        
    file_matches
  };
  
  // Collect results
  for file_match in walker {
    total_matches += file_match.matches.len();
    results.push(file_match);
  }
  
  let elapsed = start.elapsed();
  println!("Search completed in {:?}, {} matches found", elapsed, total_matches);
  
  Ok(SearchResults {
    matches: results,
    files_searched,
    total_matches,
  })
}

fn process_file(file_path: &Path, regex: &Regex, project_path: &str) -> Option<FileMatch> {
  // Skip binary files
  if is_likely_binary(file_path) {
      return None;
  }
  
  // Read file content
  let content = match fs::read_to_string(file_path) {
    Ok(content) => content,
    Err(_) => return None, // Skip files we can't read
  };
  
  // Find matches in the file
  let mut matches = Vec::new();
  for (line_number, line) in content.lines().enumerate() {
    for cap in regex.find_iter(line) {
      matches.push(Match {
        line_number: line_number + 1,
        line_content: line.to_string(),
        match_index: cap.start(),
      });
    }
  }
  
  if matches.is_empty() {
    return None;
  }
  
  // Get relative file path
  let rel_path = file_path.strip_prefix(project_path)
    .unwrap_or(file_path)
    .to_string_lossy()
    .replace('\\', "/"); // Normalize path separators
  
  Some(FileMatch {
    file_path: rel_path.to_string(),
    matches,
  })
}

// Simple heuristic to detect binary files, will probably be replaced later
fn is_likely_binary(file_path: &Path) -> bool {
  // Skip files without extensions or with binary extensions
  let binary_extensions = [
    "exe", "dll", "so", "dylib", "bin", "obj", "o", 
    "a", "lib", "png", "jpg", "jpeg", "gif", "bmp", 
    "ico", "pdf", "zip", "tar", "gz", "7z", "rar",
  ];
  
  if let Some(ext) = file_path.extension() {
    let ext_str = ext.to_string_lossy().to_lowercase();
    return binary_extensions.contains(&ext_str.as_str());
  }
  
  false
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct CommandConfig {
  name: String,
  command: String,
  args: Vec<String>,
  cwd: String,
  #[serde(skip_serializing_if = "Option::is_none")]
  env: Option<std::collections::HashMap<String, String>>,
}

#[derive(Debug, Serialize, Clone)]
struct CommandOutput {
  output: String,
  is_error: bool,
  is_final: bool,
}

// List of running processes
struct RunningProcesses(Arc<Mutex<Vec<u32>>>);

#[tauri::command]
async fn execute_command(app: tauri::AppHandle, config: CommandConfig, project_path: String) -> Result<(), String> {
  println!("Handling a new command. \nCommandConfig: name:{}, command:{}, cwd:{}", config.name, config.command, config.cwd);
  let cwd = config.cwd.replace("${workspaceFolder}", &project_path);
  
  thread::spawn(move || {
    let cwd_path = Path::new(&cwd);
    let mut cmd = Command::new(if cfg!(target_os = "windows") { "cmd" } else { "sh" });
    
    if cfg!(target_os = "windows") {
      cmd.args(["/C", &config.command]);
    } else {
      cmd.args(["-c", &config.command]);
    }
    
    if cwd_path.exists() {
      cmd.current_dir(cwd_path);
    } else {
      app.emit("command-output", CommandOutput {
        output: "Warning: Working directory does not exist.".to_string(),
        is_error: true,
        is_final: false
      }).unwrap();
    }
    
    if let Some(env_vars) = &config.env {
      for (key, value) in env_vars {
        cmd.env(key, value);
      }
    }
    
    cmd.stdout(Stdio::piped()).stderr(Stdio::piped());
    
    match cmd.spawn() {
      Ok(mut child) => {
        // Handle stdout
        if let Some(stdout) = child.stdout.take() {
          let app_clone = app.clone();
          thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines() {
              if let Ok(line) = line {
                println!("Stdout: {}", line);
                let output: CommandOutput = CommandOutput {
                  output: line,
                  is_error: false,
                  is_final: false
                };
                app_clone.emit("command-output", output).unwrap();
              }
            }
          });
        }
        
        // Handle stderr
        if let Some(stderr) = child.stderr.take() {
          let app_clone = app.clone();
          thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines() {
              if let Ok(line) = line {
                println!("Stderr: {}", line);
                let output: CommandOutput = CommandOutput {
                  output: line,
                  is_error: true,
                  is_final: false
                };
                app_clone.emit("command-output", output).unwrap();
              }
            }
          });
        }
        
        // Wait for process to complete
        let status = child.wait().unwrap();
        let output: CommandOutput = CommandOutput {
          output: format!("Process exited with: {}", status),
          is_error: false,
          is_final: true
        };
        app.emit("command-output", output).unwrap();
      },
      Err(e) => {
        let output: CommandOutput = CommandOutput {
          output: format!("Failed to start command: {}", e),
          is_error: true,
          is_final: true
        };
        app.emit("command-output", output).unwrap();
      }
    }
  });
  
  println!("\nCommand successfully handled");
  Ok(())
}

#[tauri::command]
fn terminate_command(pid: u32, state: State<'_, RunningProcesses>) -> Result<(), String> {
  let mut processes = state.0.lock().unwrap();
  if let Some(pos) = processes.iter().position(|&x| x == pid) {
    processes.remove(pos);

    #[cfg(target_os = "windows")]
    {
      Command::new("taskkill")
        .args(["/F", "/PID", &pid.to_string()])
        .output()
        .map_err(|e| e.to_string())?;
    }
    
    #[cfg(not(target_os = "windows"))]
    {
      Command::new("kill")
        .args(["-9", &pid.to_string()])
        .output()
        .map_err(|e| e.to_string())?;
    }

    Ok(())
  } else {
    Err("Process not found".to_string())
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_process::init())
    .plugin(tauri_plugin_opener::init())
    .invoke_handler(tauri::generate_handler![greet, create_window,search_in_project, execute_command, terminate_command])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
