"""Run browser regression with an isolated API host in the same process environment."""
import os
from pathlib import Path
import subprocess
import sys
from tempfile import TemporaryDirectory


root = Path(__file__).resolve().parents[2]
os.chdir(root)

with TemporaryDirectory(prefix="forge-browser-") as directory:
    environment = os.environ.copy()
    environment["XDG_DATA_HOME"] = directory
    environment["LOCALAPPDATA"] = directory
    server = subprocess.Popen(
        [sys.executable, "tests/browser/server.py"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        env=environment,
    )
    result = None

    try:
        ready = server.stdout.readline().strip()

        if ready != "READY":
            raise RuntimeError("Browser test host failed to start: " + ready)

        suites = sys.argv[1:] or ["editor.cjs", "hardening.cjs"]

        for suite in suites:
            result = subprocess.run(["node", str(root / "tests/browser" / suite)], env=environment)

            if result.returncode:
                break
    finally:
        output, errors = server.communicate("\n", timeout=10)

        if result is None or result.returncode:
            print(errors[-4000:])

    raise SystemExit(result.returncode)
