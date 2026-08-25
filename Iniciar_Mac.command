#!/bin/bash
cd "$(dirname "$0")"

if ! command -v python3 &> /dev/null; then
  echo ""
  echo "[ERRO] Python 3 nao foi encontrado neste computador."
  echo "Instale gratuitamente em https://www.python.org/downloads/"
  echo "Depois de instalar, de dois cliques neste arquivo novamente."
  echo ""
  read -p "Pressione Enter para fechar..."
  exit 1
fi

if [ ! -d "venv" ]; then
  echo "Configurando pela primeira vez, aguarde um instante..."
  python3 -m venv venv
  source venv/bin/activate
  pip install --upgrade pip > /dev/null
  if ! pip install -r requirements.txt; then
    echo ""
    echo "[ERRO] Nao foi possivel instalar os componentes necessarios."
    echo "Verifique se este computador tem internet (apenas para esta primeira vez) e tente novamente."
    read -p "Pressione Enter para fechar..."
    exit 1
  fi
else
  source venv/bin/activate
fi

python3 app.py

echo ""
echo "O servidor foi encerrado."
read -p "Pressione Enter para fechar..."
