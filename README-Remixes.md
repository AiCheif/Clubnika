# Обновление ремиксов

Запускайте из корня Clubnika в PowerShell (рекомендуется PowerShell 7).

```powershell
.\Tools\Update-Remixes.ps1 -Song new-song -Plan
.\Tools\Update-Remixes.ps1 -Song new-song
.\Tools\Update-Remixes.ps1 -Song paren-udaloy
.\Tools\Update-Remixes.ps1 -All
```

`-Plan` только читает конфигурацию и имеющиеся выгрузки, без запросов к YouTube и без записи. `-SkipDownload` использует уже сохранённые выгрузки, но обновляет статистику через API.

## Данные

- `remixes/projects.json` — список проектов, название, обложка, пути к данным, `releaseProject` для страницы релиза, `defaultProject` для страницы ремиксов.
- `remixes/<id>/sources.json` — список ID исходных роликов, из которых собираются ремиксы.
- `remixes/<id>/ranking.json` — актуальный рейтинг каналов и роликов.
- `remixes/<id>/history.json` — снимки просмотров с датами сбора.
- `remixes/authors.json` — ручные группы каналов и имена авторов, а также автоматически заполняемый кеш `channels`. Редактируйте `authors`, а не кеш; объединение выполняется сайтом.

Сырые выгрузки сохраняются в `D:\ClubnikaData\remixes\<id>\raw\<videoId>.json`. Папки создаются автоматически. Другой внешний каталог можно указать через `-DataRoot`. Инструмент использует `Tools/yt-dlp.exe` и cookies Firefox; путь к программе можно переопределить через `-YtDlp`.

Для использования существующего файла `new_song/remixes.json` скопируйте его в `D:\ClubnikaData\remixes\new-song\raw\4_LbOZCFSVM.json` и запустите с `-SkipDownload`. Старую папку не нужно добавлять в Git.

Ключ YouTube Data API читается из `YOUTUBE_API_KEY` или запрашивается интерактивно. Не записывайте ключ в файлы сайта. При ошибке скачивания/API рейтинг и история соответствующей песни не сохраняются.

## Новая песня и переименование

Для добавления песни сделайте новую папку `remixes/<id>/` с `sources.json`, укажите в `projects.json` ID, название и пути `sources`, `ranking`, `history`. Рейтинг и история создаются при первом успешном обновлении. `coverVideoId` и `shortsVideoId` используются страницей сайта.

`new-song` — временный идентификатор. Когда станет известно название, достаточно изменить `title` в `projects.json`: папка и история останутся прежними. Если нужно изменить сам ID, согласованно переименуйте папку с публичными данными и внешнюю папку выгрузок, обновите пути и ссылки `releaseProject`, `defaultProject`, `defaultUpdateProject` при необходимости. Название в рейтинге обновится при следующем запуске.
