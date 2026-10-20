package main

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
	"time"
	"unsafe"
)

func message(text string) {
	textPtr, _ := syscall.UTF16PtrFromString(text)
	title, _ := syscall.UTF16PtrFromString("Vitrine Server")
	syscall.NewLazyDLL("user32.dll").NewProc("MessageBoxW").Call(0, uintptr(unsafe.Pointer(textPtr)), uintptr(unsafe.Pointer(title)), 0)
}

func main() {
	mode := "start"
	quiet := false
	for _, arg := range os.Args[1:] {
		if arg == "--quiet" {
			quiet = true
		}
	}
	if len(os.Args) > 1 {
		mode = os.Args[1]
	}
	binary, err := os.Executable()
	if err != nil {
		message(err.Error())
		os.Exit(1)
	}
	root := filepath.Dir(binary)
	script := "Check.ps1"
	args := []string{}
	switch mode {
	case "start":
		os.Remove(filepath.Join(root, ".runtime", "maintenance"))
		args = append(args, "-Force")
	case "check":
	case "stop":
		script = "Stop.ps1"
	default:
		message("Use: VitrineServer.exe [start|check|stop]")
		os.Exit(2)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 4*time.Minute)
	defer cancel()
	shell := filepath.Join(os.Getenv("SystemRoot"), "System32", "WindowsPowerShell", "v1.0", "powershell.exe")
	commandArgs := []string{"-NoLogo", "-NoProfile", "-NonInteractive", "-File", filepath.Join(root, "deploy", "windows", script)}
	commandArgs = append(commandArgs, args...)
	command := exec.CommandContext(ctx, shell, commandArgs...)
	command.Dir = root
	command.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x08000000}
	output, runErr := command.CombinedOutput()
	logPath := filepath.Join(root, ".runtime", "logs", "launcher.log")
	if log, logErr := os.OpenFile(logPath, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0600); logErr == nil {
		fmt.Fprintf(log, "%s mode=%s result=%v\n%s\n", time.Now().Format(time.RFC3339), mode, runErr, output)
		log.Close()
	}
	if runErr != nil {
		if mode != "check" && !quiet {
			message("Не удалось запустить сервер. Подробности: .runtime/logs/launcher.log")
		}
		os.Exit(1)
	}
	if mode == "start" && !quiet {
		message("Сервер запущен.\nVisitor: http://localhost/\nКабинет методиста: http://localhost/methodist/")
	}
}
