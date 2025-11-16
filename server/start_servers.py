import subprocess
import sys
import os
from threading import Thread

def run_flask_server():
    print("Starting LLM Server (Flask) on port 5000...")
    flask_cmd = [sys.executable, "-m", "flask", "--app", "llm_server", "run", "--port", "5000"]
    subprocess.run(flask_cmd, cwd=os.path.dirname(os.path.abspath(__file__)))

def run_fastapi_server():
    print("Starting Main Server (FastAPI) on port 8000...")
    fastapi_cmd = [sys.executable, "-m", "uvicorn", "model_server:app", "--host", "0.0.0.0", "--port", "8000"]
    subprocess.run(fastapi_cmd, cwd=os.path.dirname(os.path.abspath(__file__)))

if __name__ == "__main__":
    # Start servers in separate threads
    flask_thread = Thread(target=run_flask_server)
    fastapi_thread = Thread(target=run_fastapi_server)

    try:
        flask_thread.start()
        fastapi_thread.start()

        # Keep the main thread alive
        flask_thread.join()
        fastapi_thread.join()
    except KeyboardInterrupt:
        print("\nShutting down servers...")
        sys.exit(0)