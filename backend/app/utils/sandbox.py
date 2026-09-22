"""Sandbox abstraction for isolated file parsing.

Locally this runs code in a subprocess. To use Docker Sandbox, replace the
command in ``run_python`` with ``docker sandbox run python:3.12-slim python -c <code>``
(or mount the upload directory read-only) so untrusted uploads are parsed in an
isolated container instead of the API process.
"""
import subprocess
import sys


class SandboxRunner:
    def __init__(self, python: str = sys.executable):
        self.python = python

    def run_python(self, code: str, timeout: int = 10) -> dict:
        try:
            proc = subprocess.run(
                [self.python, "-c", code],
                capture_output=True, text=True, timeout=timeout,
            )
            return {"ok": proc.returncode == 0, "stdout": proc.stdout, "stderr": proc.stderr}
        except subprocess.TimeoutExpired:
            return {"ok": False, "stdout": "", "stderr": f"timeout after {timeout}s"}
