# Lunar Landing Site Navigator

Catálogo histórico inicial de tres alunizajes Apollo, con procedencia de los datos en `data/missions.json`.

Requiere Python 3.9 o posterior y no usa dependencias externas.

```powershell
python missions.py list
python missions.py show apollo-11
python missions.py validate --report
```

`validate` comprueba IDs, campos requeridos, fechas, rangos de coordenadas y procedencia documentada. La verificación de contenido frente a las páginas fuente es documental; el comando no descarga ni vuelve a consultar NASA.
