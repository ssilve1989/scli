use anyhow::Result;
use dialoguer::{MultiSelect, theme::ColorfulTheme};

#[derive(Clone)]
pub struct ProcessEntry {
    pub pid: u32,
    pub label: String,
}

pub fn parse_lsof_output(raw: &str, port: u16) -> Vec<ProcessEntry> {
    raw.lines()
        .map(|l| l.trim())
        .filter(|l| !l.is_empty())
        .map(|pid| ProcessEntry {
            pid: pid.parse().unwrap_or(0),
            label: format!("PID {pid} (port {port})"),
        })
        .collect()
}

pub fn parse_pgrep_output(raw: &str) -> Vec<ProcessEntry> {
    raw.lines()
        .map(|l| l.trim())
        .filter(|l| !l.is_empty())
        .filter_map(|line| {
            let mut parts = line.splitn(2, ' ');
            let pid = parts.next()?;
            let rest = parts.next().unwrap_or("");
            Some(ProcessEntry {
                pid: pid.parse().unwrap_or(0),
                label: format!("{pid} — {rest}"),
            })
        })
        .collect()
}

pub fn filter_own_pid(entries: &[ProcessEntry], my_pid: u32) -> Vec<ProcessEntry> {
    entries
        .iter()
        .filter(|e| e.pid != my_pid && e.pid != 0)
        .cloned()
        .collect()
}

fn run_cmd(cmd: &str, args: &[&str]) -> Result<String> {
    let output = std::process::Command::new(cmd).args(args).output()?;
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

pub fn execute_nuke(target: &str, force: bool) -> Result<()> {
    let my_pid = std::process::id();

    let entries = if let Ok(port) = target.parse::<u16>() {
        if port < 1 {
            return Err(anyhow::anyhow!("Invalid port: {port}"));
        }
        let raw = run_cmd("lsof", &["-i", &format!(":{port}"), "-t"])?;
        parse_lsof_output(&raw, port)
    } else {
        let raw = run_cmd("pgrep", &["-fl", target])?;
        parse_pgrep_output(&raw)
    };

    let entries = filter_own_pid(&entries, my_pid);

    if entries.is_empty() {
        eprintln!("No processes found.");
        return Ok(());
    }

    let to_kill: Vec<u32> = if force {
        entries.iter().map(|e| e.pid).collect()
    } else {
        let selection = MultiSelect::with_theme(&ColorfulTheme::default())
            .with_prompt("Select processes to kill")
            .items(&entries.iter().map(|e| e.label.as_str()).collect::<Vec<_>>())
            .interact()?;
        selection.into_iter().map(|i| entries[i].pid).collect()
    };

    for pid in &to_kill {
        let status = std::process::Command::new("kill")
            .args(["-9", &pid.to_string()])
            .status()?;
        if status.success() {
            println!("Killed {pid}");
        } else {
            eprintln!("Failed to kill {pid}");
        }
    }

    let count = to_kill.len();
    let plural = if count == 1 { "" } else { "es" };
    println!("Nuked {count} process{plural}.");

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_lsof_output_single() {
        let result = parse_lsof_output("1234\n", 3000);
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].pid, 1234);
        assert_eq!(result[0].label, "PID 1234 (port 3000)");
    }

    #[test]
    fn test_parse_lsof_output_multiple() {
        let result = parse_lsof_output("1234\n5678\n", 8080);
        assert_eq!(result.len(), 2);
        assert_eq!(result[0].pid, 1234);
        assert_eq!(result[1].pid, 5678);
    }

    #[test]
    fn test_parse_lsof_output_empty() {
        let result = parse_lsof_output("", 3000);
        assert!(result.is_empty());
    }

    #[test]
    fn test_parse_lsof_output_whitespace() {
        let result = parse_lsof_output("   \n  \n", 3000);
        assert!(result.is_empty());
    }

    #[test]
    fn test_parse_pgrep_output_single() {
        let result = parse_pgrep_output("1234 node server.js\n");
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].pid, 1234);
        assert_eq!(result[0].label, "1234 — node server.js");
    }

    #[test]
    fn test_parse_pgrep_output_multi_word() {
        let result = parse_pgrep_output("5678 bun run dev --port 3000\n");
        assert_eq!(result[0].pid, 5678);
        assert!(result[0].label.contains("bun run dev"));
    }

    #[test]
    fn test_parse_pgrep_output_empty() {
        assert!(parse_pgrep_output("").is_empty());
    }

    #[test]
    fn test_parse_pgrep_output_multiple() {
        let result = parse_pgrep_output("111 node a.js\n222 bun b.ts\n");
        assert_eq!(result.len(), 2);
    }

    #[test]
    fn test_filter_own_pid_removes_matching() {
        let entries = vec![
            ProcessEntry {
                pid: 100,
                label: "a".to_string(),
            },
            ProcessEntry {
                pid: 200,
                label: "b".to_string(),
            },
        ];
        let result = filter_own_pid(&entries, 200);
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].pid, 100);
    }

    #[test]
    fn test_filter_own_pid_removes_zero() {
        let entries = vec![
            ProcessEntry {
                pid: 0,
                label: "bad".to_string(),
            },
            ProcessEntry {
                pid: 100,
                label: "good".to_string(),
            },
        ];
        let result = filter_own_pid(&entries, 999);
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].pid, 100);
    }

    #[test]
    fn test_filter_own_pid_passthrough() {
        let entries = vec![ProcessEntry {
            pid: 100,
            label: "a".to_string(),
        }];
        let result = filter_own_pid(&entries, 999);
        assert_eq!(result.len(), 1);
    }
}
