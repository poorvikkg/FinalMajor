import os
import sys
import subprocess
import threading
import time

# Ensure stdout and stderr handle UTF-8 properly on Windows console
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
if hasattr(sys.stderr, 'reconfigure'):
    try:
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

# ANSI Color codes for terminal output
COLOR_BACKEND = "\033[36m"    # Cyan
COLOR_AI = "\033[35m"         # Magenta
COLOR_FRONTEND = "\033[32m"   # Green
COLOR_DOCKER = "\033[33m"     # Yellow
COLOR_RESET = "\033[0m"
COLOR_BOLD = "\033[1m"

def print_log(prefix, color, message):
    try:
        print(f"{color}{COLOR_BOLD}[{prefix}]{COLOR_RESET} {message}", flush=True)
    except Exception:
        # Fallback if terminal cannot print certain chars
        safe_msg = message.encode('ascii', errors='replace').decode('ascii')
        print(f"[{prefix}] {safe_msg}", flush=True)

def stream_reader(pipe, prefix, color):
    try:
        for line in iter(pipe.readline, ''):
            if not line:
                break
            print_log(prefix, color, line.rstrip())
    except Exception:
        pass
    finally:
        try:
            pipe.close()
        except Exception:
            pass

def main():
    root_dir = os.path.abspath(os.path.dirname(__file__))
    backend_dir = os.path.join(root_dir, "backend")
    ai_dir = os.path.join(root_dir, "ai-service")
    frontend_dir = os.path.join(root_dir, "frontend")

    print_log("SYSTEM", COLOR_BOLD, "Starting Sentinel Face Recognition & Surveillance System...")

    # 1. Start Docker Infrastructure
    print_log("DOCKER", COLOR_DOCKER, "Starting Docker services (MongoDB, Redis, MinIO)...")
    try:
        res = subprocess.run(["docker-compose", "up", "-d"], cwd=root_dir, capture_output=True, text=True, encoding='utf-8', errors='replace')
        if res.returncode != 0:
            res = subprocess.run(["docker", "compose", "up", "-d"], cwd=root_dir, capture_output=True, text=True, encoding='utf-8', errors='replace')
        if res.returncode == 0:
            print_log("DOCKER", COLOR_DOCKER, "Docker infrastructure started successfully.")
        else:
            err = (res.stderr or res.stdout or "").strip()
            print_log("DOCKER", COLOR_DOCKER, f"Docker output: {err}")
    except Exception as e:
        print_log("DOCKER", COLOR_DOCKER, f"Could not run docker-compose ({e}). Please ensure Docker Desktop is running if database access is required.")

    # 2. Determine Python Executable for AI Service
    ai_python = sys.executable
    if os.name == 'nt':
        venv_python = os.path.join(ai_dir, "venv", "Scripts", "python.exe")
    else:
        venv_python = os.path.join(ai_dir, "venv", "bin", "python")
    
    if os.path.exists(venv_python):
        ai_python = venv_python
        print_log("AI-SERVICE", COLOR_AI, f"Using virtual environment Python: {venv_python}")
    else:
        print_log("AI-SERVICE", COLOR_AI, f"Using system Python: {ai_python}")

    processes = []
    use_shell = (os.name == 'nt')

    try:
        # 3. Launch Backend
        print_log("BACKEND", COLOR_BACKEND, "Launching Backend service (Express / Node.js)...")
        backend_cmd = "npm run dev" if use_shell else ["npm", "run", "dev"]
        backend_proc = subprocess.Popen(
            backend_cmd,
            cwd=backend_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding='utf-8',
            errors='replace',
            bufsize=1,
            shell=use_shell
        )
        processes.append(("BACKEND", backend_proc))
        threading.Thread(target=stream_reader, args=(backend_proc.stdout, "BACKEND", COLOR_BACKEND), daemon=True).start()

        # 4. Launch AI Service
        print_log("AI-SERVICE", COLOR_AI, "Launching AI Service (FastAPI / Uvicorn)...")
        ai_cmd = f'"{ai_python}" -m uvicorn main:app --reload --port 8000' if use_shell else [ai_python, "-m", "uvicorn", "main:app", "--reload", "--port", "8000"]
        ai_proc = subprocess.Popen(
            ai_cmd,
            cwd=ai_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding='utf-8',
            errors='replace',
            bufsize=1,
            shell=use_shell
        )
        processes.append(("AI-SERVICE", ai_proc))
        threading.Thread(target=stream_reader, args=(ai_proc.stdout, "AI-SERVICE", COLOR_AI), daemon=True).start()

        # 5. Launch Frontend
        print_log("FRONTEND", COLOR_FRONTEND, "Launching Frontend service (Vite / React)...")
        frontend_cmd = "npm run dev" if use_shell else ["npm", "run", "dev"]
        frontend_proc = subprocess.Popen(
            frontend_cmd,
            cwd=frontend_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding='utf-8',
            errors='replace',
            bufsize=1,
            shell=use_shell
        )
        processes.append(("FRONTEND", frontend_proc))
        threading.Thread(target=stream_reader, args=(frontend_proc.stdout, "FRONTEND", COLOR_FRONTEND), daemon=True).start()

        print_log("SYSTEM", COLOR_BOLD, "\n[SUCCESS] All services launched! Press Ctrl+C to stop all services.\n")

        # Keep main thread alive
        while True:
            time.sleep(1)
            for name, proc in processes:
                if proc.poll() is not None:
                    print_log("SYSTEM", COLOR_BOLD, f"[NOTICE] Process [{name}] exited with code {proc.returncode}")

    except KeyboardInterrupt:
        print_log("SYSTEM", COLOR_BOLD, "\n[SHUTDOWN] Signal received. Stopping all services...")
    finally:
        for name, proc in processes:
            if proc.poll() is None:
                print_log("SYSTEM", COLOR_BOLD, f"Stopping [{name}]...")
                try:
                    if os.name == 'nt':
                        subprocess.run(f"taskkill /F /T /PID {proc.pid}", shell=True, capture_output=True)
                    else:
                        proc.terminate()
                        proc.wait(timeout=3)
                except Exception:
                    try:
                        proc.kill()
                    except Exception:
                        pass
        print_log("SYSTEM", COLOR_BOLD, "All services stopped.")

if __name__ == "__main__":
    main()
