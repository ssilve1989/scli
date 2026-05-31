use std::process::Output;

#[derive(Debug, thiserror::Error)]
pub enum ShellError {
    #[error("Command failed: {stderr}")]
    CommandFailed { stderr: String },
    #[error("{0}")]
    Io(#[from] std::io::Error),
}

pub fn extract_stderr(output: &Output) -> String {
    String::from_utf8_lossy(&output.stderr).trim().to_string()
}
