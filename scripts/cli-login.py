"""Give the official login CLI a terminal; forward input without logging secrets."""
import os
import fcntl
import pty
import select
import signal
import sys
import struct
import termios

commands = {
    "codex": ["codex", "login", "--device-auth", "-c", 'cli_auth_credentials_store="file"'],
    "muse": ["muse", "login"],
    "agy": ["agy", "--mode", "plan"],
}
if len(sys.argv) != 2 or sys.argv[1] not in commands:
    sys.exit(2)

pid, fd = pty.fork()
if pid == 0:
    fcntl.ioctl(0, termios.TIOCSWINSZ, struct.pack('HHHH', 80, 4096, 0, 0))
    os.execvp(commands[sys.argv[1]][0], commands[sys.argv[1]])


def stop(_signum, _frame):
    try:
        os.kill(pid, signal.SIGTERM)
    except ProcessLookupError:
        pass
    sys.exit(1)


signal.signal(signal.SIGTERM, stop)
signal.signal(signal.SIGINT, stop)
while True:
    ready, _, _ = select.select([fd, sys.stdin.fileno()], [], [], 1)
    if fd in ready:
        try:
            data = os.read(fd, 8192)
        except OSError:
            break
        if not data:
            break
        sys.stdout.buffer.write(data)
        sys.stdout.buffer.flush()
    if sys.stdin.fileno() in ready:
        data = os.read(sys.stdin.fileno(), 8192)
        if data:
            os.write(fd, data)
    finished, status = os.waitpid(pid, os.WNOHANG)
    if finished:
        sys.exit(os.waitstatus_to_exitcode(status))
_, status = os.waitpid(pid, 0)
sys.exit(os.waitstatus_to_exitcode(status))
