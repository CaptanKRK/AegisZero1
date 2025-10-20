#!/usr/bin/env python3
"""
AEGIS Server Startup Script
Choose between Flask (simple) or FastAPI (advanced) server
"""

import os
import sys
import subprocess

def check_dependencies():
    """Check if required packages are installed"""
    try:
        import flask
        import fastapi
        import pandas
        import sklearn
        print("✓ All dependencies are installed")
        return True
    except ImportError as e:
        print(f"✗ Missing dependency: {e}")
        print("Run: pip install -r requirements.txt")
        return False

def run_flask_server():
    """Run the Flask server (simple version)"""
    print("Starting Flask server on http://localhost:5000")
    try:
        subprocess.run([sys.executable, "app.py"], check=True)
    except subprocess.CalledProcessError as e:
        print(f"Flask server failed: {e}")
    except KeyboardInterrupt:
        print("\nFlask server stopped")

def run_fastapi_server():
    """Run the FastAPI server (advanced version)"""
    print("Starting FastAPI server on http://localhost:8000")
    try:
        subprocess.run([sys.executable, "-m", "uvicorn", "model_server:app", "--host", "0.0.0.0", "--port", "8000", "--reload"], check=True)
    except subprocess.CalledProcessError as e:
        print(f"FastAPI server failed: {e}")
    except KeyboardInterrupt:
        print("\nFastAPI server stopped")

def cleanup():
    """Run cleanup script"""
    print("Running cleanup...")
    try:
        subprocess.run([sys.executable, "cleanup.py"], check=True)
    except subprocess.CalledProcessError as e:
        print(f"Cleanup failed: {e}")

def main():
    print("🛡️  AEGIS Server Startup")
    print("=" * 40)
    
    if not check_dependencies():
        return
    
    while True:
        print("\nChoose server type:")
        print("1. Flask Server (Simple) - Port 5000")
        print("2. FastAPI Server (Advanced) - Port 8000") 
        print("3. Run Cleanup")
        print("4. Exit")
        
        choice = input("\nEnter choice (1-4): ").strip()
        
        if choice == "1":
            run_flask_server()
        elif choice == "2":
            run_fastapi_server()
        elif choice == "3":
            cleanup()
        elif choice == "4":
            print("Goodbye!")
            break
        else:
            print("Invalid choice. Please enter 1-4.")

if __name__ == "__main__":
    main()
