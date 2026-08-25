# BI · Reunião de Jovens e Menores

Aplicativo local (Flask + SQLite) para registrar e analisar os formulários da
**Reunião de Jovens e Menores** da Congregação Cristã no Brasil. Roda no
computador da igreja — sem instalar servidor, sem internet no dia a dia — e
fica disponível para qualquer celular/tablet conectado na mesma rede Wi-Fi
através de um link (e um QR code).

![Dashboard](docs/screenshot-dashboard.png)

## Funcionalidades

- **Formulário digital** que espelha o impresso: recitativos por naipe e
  posição, recitativos individuais, visitas e a seção "Palavra".
- **Validação bíblica de verdade**: Livro, Capítulo e Versículo são selects
  em cascata que só permitem combinações que existem na Bíblia (dados de
  versificação embutidos, veja `biblia_dados.py`).
- **Localidade oficial da CCB**: os campos Estado/Cidade vêm do diretório
  público da CCB (`static/dados/localidades_ccb.json`, baixado uma única vez
  do site oficial) — funciona 100% offline depois de instalado.
- **Rascunho automático**: o formulário salva o preenchimento sozinho neste
  aparelho (`localStorage`), então dá pra sair no meio do culto sem perder
  nada.
- **Dois níveis de acesso** (login simples, duas senhas compartilhadas):
  Cooperador de Jovens (acesso completo) e Irmãos da Contagem (só
  registro/edição, sem excluir e sem ver as Análises).
- **Painel de Análises**: KPIs e gráficos (SVG, sem biblioteca externa) com
  filtro por período e por localidade.
- **Acesso pela rede local**: link + QR code exibidos no menu — qualquer
  aparelho no mesmo Wi‑Fi acessa sem instalar nada.

![Formulário](docs/screenshot-formulario.png)

## Como usar (igreja / usuário final)

Veja [`LEIA-ME.txt`](LEIA-ME.txt) — instruções em português, passo a passo,
para quem só quer rodar o programa (não precisa saber programar).

Resumo:

1. Copie a pasta do projeto para o computador da igreja.
2. Instale o [Python 3](https://www.python.org/downloads/) (uma vez só).
3. Dê dois cliques em `Iniciar_Windows.bat` (Windows) ou `Iniciar_Mac.command`
   (Mac). Da segunda vez em diante abre em segundos, mesmo sem internet.

## Desenvolvimento

```bash
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
python3 app.py                  # http://127.0.0.1:8000
```

**Stack**: Python 3 + Flask + SQLite (sem ORM), Jinja2, CSS/JS puros (sem
build step, sem framework de frontend), gráficos em SVG feitos à mão
(`static/js/charts.js`).

**Antes de usar de verdade**, troque as senhas de exemplo em
[`config_acesso.py`](config_acesso.py).

## Estrutura

```
app.py                    rotas Flask, login, validação
database.py                acesso ao SQLite + validação bíblica
biblia_dados.py            estrutura da Bíblia (capítulos/versículos)
config_acesso.py           as duas senhas de acesso
templates/                 páginas (Jinja2)
static/css/style.css       tema (claro/escuro), paleta, tipografia
static/js/charts.js        gráficos SVG (linha/barra) sem dependências
static/js/form.js          cascatas do formulário + rascunho automático
static/dados/localidades_ccb.json   estados/cidades (diretório oficial CCB)
```

## Licença

Código sob [MIT](LICENSE).

**Marcas**: "Congregação Cristã no Brasil", a sigla "CCB" e o emblema
institucional são marcas da Congregação Cristã no Brasil e **não** estão
cobertas pela licença MIT. Este é um projeto **não-oficial**, construído por
um membro/colaborador para uso interno de uma congregação local — sem
vínculo com a administração nacional da CCB. Se for adaptar este projeto
para outro fim que não seja uso interno de uma congregação da CCB, troque o
nome, as cores e os arquivos em `static/img/` pela sua própria identidade.
