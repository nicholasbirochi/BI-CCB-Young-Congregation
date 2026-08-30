# -*- coding: utf-8 -*-
"""Rede local: descobrir o IP deste computador e abrir o navegador sozinho."""
import socket
import webbrowser


def get_lan_ip():
    """Descobre o IP deste computador na rede local (não precisa de internet)."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("10.255.255.255", 1))
        ip = s.getsockname()[0]
    except Exception:
        ip = "127.0.0.1"
    finally:
        s.close()
    return ip


def abrir_navegador(port):
    webbrowser.open(f"http://127.0.0.1:{port}")
