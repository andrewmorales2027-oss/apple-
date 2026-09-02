"""Shared fixtures."""

from __future__ import annotations

import pytest

from jarvis import Assistant, load_config


@pytest.fixture
def config(tmp_path):
    """A config that never touches the real home directory or the network."""
    return load_config(data_dir=tmp_path, brain_enabled=False, allow_launch=False)


@pytest.fixture
def assistant(config):
    instance = Assistant(config)
    yield instance
    instance.shutdown()
