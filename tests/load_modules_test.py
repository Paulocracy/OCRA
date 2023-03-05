from flask import Flask, render_template
from flask_socketio import SocketIO, send, emit


def test_load_modules():
    assert 1 == 1
