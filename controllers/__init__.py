# -*- coding: utf-8 -*-
"""
controllers — a camada "C" do MVC: um Blueprint do Flask por área da
aplicação, cada um só lendo requisição, chamando models/services e
devolvendo um template (view) ou um redirect. Nenhuma regra de negócio
pesada mora aqui — isso fica em services/models.
"""
