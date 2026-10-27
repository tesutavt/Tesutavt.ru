<div align="center">

<img src="https://tester.kappa.lol/zKGSn.png" width="300" alt="TesutaVT.ru logo"/>

# ✨ TesutaVT.ru

**Панель для стримера: Twitch-чатбот, оверлеи для OBS, награды за баллы, музыка и VTube Studio — в одном месте.**

<<p>
  <img src="https://img.shields.io/badge/Twitch-363a4f?style=for-the-badge&logo=twitch&logoColor=c6a0f6" alt="Twitch"/>
  <img src="https://img.shields.io/badge/OBS-363a4f?style=for-the-badge&logo=obsstudio&logoColor=cad3f5" alt="OBS"/>
  <img src="https://img.shields.io/badge/VTube%20Studio-363a4f?style=for-the-badge&logoColor=f5bde6" alt="VTube Studio"/>
  <img src="https://img.shields.io/badge/Web-363a4f?style=for-the-badge&logo=googlechrome&logoColor=8aadf4" alt="Web"/>
</p>

<img src="https://img.shields.io/badge/статус-в%20разработке-f5a97f?style=flat-square&labelColor=363a4f" alt="Status"/>

<br/><br/>

[🚀 Демо](https://tesutavt.ru) · [🐛 Сообщить об ошибке](https://github.com/tesutavt/Tesutavt.ru/issues) · [💡 Предложить идею](https://github.com/tesutavt/Tesutavt.ru/issues)

</div>

<img src="https://raw.githubusercontent.com/catppuccin/catppuccin/main/assets/palette/macchiato.png" width="100%" height="2" alt=""/>

<details>
<summary><b>📑 Содержание</b></summary>

- [О проекте](#-о-проекте)
- [Возможности](#-возможности)
- [Технологии](#%EF%B8%8F-технологии)
- [Установка и запуск](#-установка-и-запуск)
- [VTube Studio](#-vtube-studio)
- [Структура проекта](#-структура-проекта)
- [Планы](#%EF%B8%8F-планы)
- [Автор](#-автор)

</details>

## 📖 О проекте

TesutaVT.ru — веб-дашборд для Twitch-стримера. Вход через Twitch, после чего в одной панели
настраиваются оверлеи для OBS, чат-бот, награды за баллы канала, очередь заказа музыки
и управление моделью в VTube Studio прямо из чата.

Проект сделан под собственные стримы, чтобы не держать пачку разрозненных сервисов
и иметь полный контроль над тем, как выглядят и работают оверлеи.

## 🌟 Возможности

- ✅ **Виджеты для OBS** — готовые шаблоны (алерты, чат, часы, цель по фолловерам, плеер) или свой HTML/CSS/JS с данными Twitch, визуальный редактор с слоями
- ✅ **Чат-бот** — команды, автосообщения по таймеру, модерация, секреты для Blueprint-графов
- ✅ **Blueprint-редактор** — логика команд и наград собирается визуальными графами
- ✅ **Награды за баллы** — создаются в панели и сразу появляются на Twitch
- ✅ **Музыка** — очередь заказов `!song` из YouTube и Яндекс.Музыки
- ✅ **VTube Studio** — зрители запускают анимации модели командой `!vts`
- ✅ **Зрители** — мини-база данных, которую зрители заполняют сами из чата
- ✅ **Редакторы** — доступ к панели для модераторов, шаринг виджетов
- ✅ **Статистика** канала на главной странице дашборда

## 🛠️ Технологии

<p align="left">
  <img src="https://skillicons.dev/icons?i=nextjs,react,ts,tailwind,prisma,postgres,docker,nginx" alt="Tech stack"/>
</p>

Next.js (App Router) · React 19 · TypeScript · Prisma + PostgreSQL · Auth.js (Twitch OAuth) · Tailwind CSS · Docker

## 🚀 Установка и запуск

**Требования:** сервер с Docker и Docker Compose, домен, указывающий на сервер, открытые порты 80/443.
Для локальной разработки — Node.js 22+ и PostgreSQL.

### Twitch-приложение

На https://dev.twitch.tv/console/apps создайте приложение и укажите OAuth Redirect URL:

```
https://ваш-домен/api/auth/callback/twitch
```

Скопируйте Client ID и Client Secret.

### Автоматическая установка (чистый Ubuntu)

```bash
git clone https://github.com/tesutavt/Tesutavt.ru.git
cd Tesutavt.ru
sudo ./install.sh
```

Скрипт поставит Docker и Caddy, настроит файрвол, спросит домен и ключи Twitch, создаст `.env`
и запустит контейнеры.

### Ручной деплой через Docker

```bash
git clone https://github.com/tesutavt/Tesutavt.ru.git
cd Tesutavt.ru
cp .env.example .env
# заполните .env: POSTGRES_PASSWORD, NEXTAUTH_URL, AUTH_SECRET (npx auth secret),
# TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET
docker compose up -d --build
```

Миграции Prisma накатываются автоматически при каждом старте контейнера.
Перед приложением поставьте reverse proxy с TLS: Caddy (`deploy/Caddyfile`) или nginx
(`deploy/nginx.conf` + certbot). Проверка состояния: `GET /api/health`.

### Локальная разработка

```bash
npm install
# поднимите Postgres и укажите DATABASE_URL в .env
npx prisma migrate deploy
npm run dev
```

## 🎭 VTube Studio

Во вкладке «VTube Studio» дашборда есть постоянная ссылка `/vts/<bridgeToken>` — её нужно один раз
добавить в OBS как источник «Браузер» на том же ПК, где запущен VTube Studio. Страница-мост сама
подключается к `ws://127.0.0.1:8001`, присылает в дашборд список хоткеев и выполняет `!vts <имя>`.
Разрешение даётся один раз кнопкой «Allow» в самом VTube Studio.

Запасной вариант, если OBS не пускает страницу к локальному порту, — локальный релей (Node.js 22+):

```bash
node tools/vts-relay.js --url https://ваш-домен --token <bridgeToken>
```

## 📂 Структура проекта

```
Tesutavt.ru/
├── src/
│   ├── app/          # страницы и API-роуты (Next.js App Router)
│   ├── components/   # UI-компоненты дашборда и редакторов
│   ├── lib/          # бот, музыка, награды, Blueprint, пресеты виджетов
│   ├── config/       # навигация дашборда
│   └── styles/       # тема
├── prisma/           # схема БД и миграции
├── deploy/           # конфиги Caddy и nginx
├── tools/            # локальный релей для VTube Studio
├── Dockerfile
├── docker-compose.yml
├── install.sh        # установка на чистый Ubuntu
└── .env.example
```

## 🗺️ Планы

- [x] Виджеты и визуальный редактор оверлеев
- [x] Чат-бот с командами и таймерами
- [x] Награды за баллы и Blueprint-графы
- [x] Музыка и VTube Studio
- [ ] Скриншоты в README
- [ ] Новые шаблоны виджетов

## 💜 Автор

<table>
  <tr>
    <td align="center">
      <a href="https://github.com/tesutavt">
        <img src="https://github.com/tesutavt.png" width="100" style="border-radius:50%" alt="Tesuta"/><br/>
        <b>Tesuta</b>
      </a><br/>
      <sub>втубер · программист</sub>
    </td>
  </tr>
</table>

<img src="https://raw.githubusercontent.com/catppuccin/catppuccin/main/assets/palette/macchiato.png" width="100%" height="2" alt=""/>

<p align="center">
  <i>Если проект понравился — поставь ⭐, мне будет приятно!</i>
</p>
