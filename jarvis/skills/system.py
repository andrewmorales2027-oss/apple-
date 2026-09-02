"""What the machine is doing right now, using only the standard library."""

from __future__ import annotations

import os
import platform
import shutil
import time
from pathlib import Path

from jarvis.core.skills import Reply, skill


def _gigabytes(value: float) -> str:
    return f"{value / 1024 ** 3:.1f} gigabytes"


def _memory() -> dict[str, float] | None:
    """Total and available RAM in bytes, on systems that will tell us."""
    meminfo = Path("/proc/meminfo")
    if meminfo.is_file():  # Linux
        values = {}
        for line in meminfo.read_text().splitlines():
            key, _, rest = line.partition(":")
            parts = rest.split()
            if parts:
                values[key] = float(parts[0]) * 1024
        if "MemTotal" in values:
            available = values.get("MemAvailable", values.get("MemFree", 0.0))
            return {"total": values["MemTotal"], "available": available}
    try:  # macOS and the rest, when psutil happens to be installed
        import psutil

        virtual = psutil.virtual_memory()
        return {"total": float(virtual.total), "available": float(virtual.available)}
    except Exception:
        return None


def _uptime() -> float | None:
    uptime_file = Path("/proc/uptime")
    if uptime_file.is_file():
        try:
            return float(uptime_file.read_text().split()[0])
        except (ValueError, IndexError):
            return None
    try:
        import psutil

        return time.time() - psutil.boot_time()
    except Exception:
        return None


def _spoken_duration(seconds: float) -> str:
    days, rest = divmod(int(seconds), 86400)
    hours, rest = divmod(rest, 3600)
    minutes = rest // 60
    if days:
        return f"{days} day{'s' if days != 1 else ''} and {hours} hours"
    if hours:
        return f"{hours} hour{'s' if hours != 1 else ''} and {minutes} minutes"
    return f"{minutes} minute{'s' if minutes != 1 else ''}"


@skill(
    "system_status",
    "Report this machine's load, memory, disk space and uptime.",
    patterns=[
        r"\b(?:system|machine|computer|cpu|memory|disk|hardware)\b.*"
        r"\b(?:status|report|stats|usage|check|how|doing|left|free)\b",
        r"\b(?:how are you (?:holding up|doing on resources)|status report|"
        r"diagnostics|run diagnostics|system check)\b",
        r"\bhow much (?:disk|memory|ram|space)\b",
    ],
    examples=["run diagnostics", "how much memory is free"],
)
def system_status() -> Reply:
    data: dict[str, object] = {
        "platform": f"{platform.system()} {platform.release()}",
        "python": platform.python_version(),
        "cpus": os.cpu_count(),
    }
    spoken = []

    try:
        load = os.getloadavg()[0]
        per_core = load / (os.cpu_count() or 1)
        data["load_1m"] = round(load, 2)
        spoken.append(f"Processor load is {per_core * 100:.0f} percent")
    except (OSError, AttributeError):  # not available on Windows
        spoken.append(f"Running on {os.cpu_count()} cores")

    memory = _memory()
    if memory:
        used_fraction = 1 - memory["available"] / memory["total"]
        data["memory_total"] = memory["total"]
        data["memory_available"] = memory["available"]
        spoken.append(
            f"memory is {used_fraction * 100:.0f} percent used, "
            f"{_gigabytes(memory['available'])} free"
        )

    disk = shutil.disk_usage(Path.home())
    data["disk_free"] = disk.free
    data["disk_total"] = disk.total
    spoken.append(f"{_gigabytes(disk.free)} free on disk")

    uptime = _uptime()
    if uptime:
        data["uptime_seconds"] = uptime
        spoken.append(f"up {_spoken_duration(uptime)}")

    return Reply(speech="All systems nominal. " + ", ".join(spoken) + ".", data=data)
