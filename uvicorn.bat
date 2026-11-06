@echo off
"%~dp0backend\.venv\Scripts\python.exe" -m uvicorn %*
