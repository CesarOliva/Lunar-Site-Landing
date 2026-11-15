# Plan por fases de Lunar Landing Site Navigator

El producto final será un sitio web para explorar la Luna en 3D en un momento determinado. La vista mostrará la iluminación solar del globo y permitirá inspeccionar las condiciones en un punto de la superficie. El primer recorrido del usuario será seleccionar Apollo 11, Apollo 12 o Apollo 14, ver dónde y cuándo alunizó y abrir la escena correspondiente a ese momento. Después podrá ingresar sus propias coordenadas y una fecha y hora.

## Alcance y entregas

| Entrega | Qué puede hacer el usuario | Fases |
|---|---|---|
| Base de datos y comparación | Consultar misiones históricas y comprobar cómo cambian las ventanas de visibilidad entre sitios y fechas | 1 a 5 |
| MVP histórico 3D | Seleccionar una de las tres misiones, ver el sitio en el globo e inspeccionar la iluminación y las condiciones estimadas al alunizar | 6 y 7 |
| Explorador completo | Ingresar un punto y una fecha y hora, ver la escena correspondiente y consultar las condiciones con el nivel de detalle que permita la cobertura | 8 y 9 |

Las fases 1 a 4 se apoyan en el catálogo, los cálculos y el comparador de consola trabajados previamente. La fase 5 parte del plan del comparador web. Al comenzar, comprobar qué entregables de esa fase ya funcionan en el repositorio.

## Datos históricos mínimos

| Misión | Sitio | Alunizaje según NSSDCA (UT) | Latitud | Longitud |
|---|---|---|---:|---:|
| Apollo 11 | Mare Tranquillitatis | 1969-07-20 20:17:40 | 0.67416° | 23.47314° |
| Apollo 12 | Oceanus Procellarum | 1969-11-19 06:54:35 | −3.0128° | −23.4219° |
| Apollo 14 | Fra Mauro | 1971-02-05 09:18:11 | −3.64589° | −17.47194° |

Las coordenadas del módulo lunar usan el marco planetocéntrico Mean Earth/Polar Axis (ME), DE421, con norte y este positivos. Conservar las horas originales tal como las publica la fuente y documentar cómo se interpretan para consultar las efemérides históricas. Entre fuentes de NASA existe una diferencia de un segundo para Apollo 11. El catálogo usa la hora de NSSDCA y registra la alternativa en la ficha. Fuentes: [Coordenadas de alunizaje](https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html), [Apollo 11](https://nssdc.gsfc.nasa.gov/planetary/lunar/apollo11info.html), [Apollo 12](https://nssdc.gsfc.nasa.gov/planetary/lunar/apollo12info.html), [Apollo 14](https://nssdc.gsfc.nasa.gov/planetary/lunar/apollo14info.html) y [cronología histórica de Apollo 11](https://www.nasa.gov/wp-content/uploads/static/history/SP-4029/Apollo_11a_Summary.htm).

## Fases 1 a 5. Base del proyecto

| Fase | Trabajo | Criterio de cierre |
|---|---|---|
| 1. Catálogo verificado | Mantener el JSON con las tres fichas, sus coordenadas, hora y procedencia por campo. | Se puede rastrear cada valor hasta su fuente y consultar cada misión por ID. |
| 2. Visibilidad en un punto | Combinar el horizonte calculado con LOLA y el azimut y elevación obtenidos de Horizons. | El caso de Sol a 2° y horizonte a 4° resulta oculto. Una corrida con datos reales permite revisar una transición. |
| 3. Análisis multisitio | Procesar tres puntos del polo sur con criterios comunes y exportar muestras e intervalos. | Se puede reproducir un contraste entre sitios y rastrear sus resultados hasta los insumos. |
| 4. Comparador en consola | Comparar dos sitios en un mismo periodo o un sitio en dos periodos de igual duración. | Los reportes muestran horas visibles, interrupciones, coincidencia y tiempo indeterminado con intervalos recortados al rango. |
| 5. Comparador web | Integrar los datos precalculados, el resumen A/B, cuatro filas de tiempo y el detalle angular en React y TypeScript. | Ambos modos coinciden con consola y la interfaz permite identificar qué relieve explica una obstrucción. |

Los tres puntos del polo sur sirven para la comparación. Apollo 11, 12 y 14 son casos históricos independientes. Para reproducir sus condiciones se necesitan efemérides de sus fechas y, si se evalúa obstrucción local, relieve con cobertura en sus propias coordenadas.

## Fase 6. Globo lunar 3D e iluminación global

1. Integrar un globo rotatorio con zoom mediante React, TypeScript y React Three Fiber. Usar una textura lunar de [NASA SVS CGI Moon Kit](https://svs.gsfc.nasa.gov/4720) y documentar su orientación y procedencia.
2. Acordar un marco lunar entre datos, textura y render. Implementar la transformación de latitud y longitud a la posición del marcador y verificar el signo de la longitud, la orientación de los polos y el meridiano de referencia.
3. Usar la dirección Luna–Sol expresada en el marco fijo a la Luna para orientar una luz direccional. Obtener esa dirección con las efemérides y la orientación lunar correspondientes al instante. Verificar la transformación si el marco de las efemérides y el de la textura difieren.
4. Mostrar la división entre hemisferios iluminado y oscuro sobre el globo. Si se incorpora relieve visual, indicar en el panel de método el alcance de la simulación. Las sombras del terreno local se calculan con el perfil de horizonte.
5. Probar la carga, tamaño de assets y controles de cámara. Mantener disponible la ficha de misión y los resultados en texto cuando WebGL no esté disponible.

**Criterio de cierre.** Los tres marcadores coinciden con sus regiones conocidas. En dos instantes de prueba, el punto subsolar calculado coincide con el centro del hemisferio iluminado. Mover la cámara conserva la iluminación del instante seleccionado.

## Fase 7. Reproducción de los alunizajes Apollo

- Crear una vista de misiones con ficha histórica, selector y acción para mostrar el alunizaje. Al seleccionar una misión, enfocar el globo en sus coordenadas y fijar el tiempo a la hora histórica registrada.
- Precalcular para cada misión y su instante la dirección global del Sol y las posiciones aparentes del Sol y la Tierra desde el sitio. Si existe un modelo de elevación adecuado, calcular también el horizonte local en sus azimuts. Conservar los archivos originales y los parámetros de consulta.
- Mostrar en el panel la hora de alunizaje, las coordenadas, los ángulos del Sol y la Tierra y el estado de cada cuerpo. Si el sitio carece de cobertura de terreno válida, mostrar la elevación sobre el horizonte geométrico y marcar la visibilidad con relieve como indeterminada.
- Verificar que el globo y el panel usen el mismo instante. Mantener el caso documentado de discrepancia horaria de Apollo 11 visible en la ficha de fuentes.

**Criterio de cierre.** Las tres misiones se pueden seleccionar desde la web. Cada una centra el sitio correcto, reproduce la iluminación correspondiente a su instante y muestra datos con sus fuentes y nivel de cobertura. Los tres casos se pueden abrir con datos precalculados durante la demo.

## Fase 8. Consulta por coordenadas y fecha

1. Añadir un formulario con latitud lunar de −90° a 90°, longitud de −180° a 180° con este positivo, fecha y hora explícitas. Usar UTC para nuevas consultas en los periodos en que aplique y mostrar la escala temporal al usuario. Al aceptar un punto o una fecha, actualizar juntos el marcador, el globo y el panel.
2. Mantener precalculadas las escenas Apollo. Para consultas personalizadas, usar un endpoint que valide las entradas, consulte [JPL Horizons](https://ssd-api.jpl.nasa.gov/doc/horizons.html) y reutilice el cálculo de horizonte donde exista cobertura. Si el motor actual está en Python, FastAPI permite exponerlo a React sin trasladar el procesamiento de rasters al navegador. Guardar en caché por posición, instante y versión de los datos.
3. Mostrar la iluminación global para el instante y los valores locales de azimut, elevación y visibilidad geométrica. Mostrar visibilidad respecto al relieve cuando haya perfil válido y estado indeterminado cuando falte cobertura. Acotar los rangos de fecha a lo que el servicio y la app hayan validado. Mostrar errores y permitir reintentar si falla la consulta.
4. Si el usuario quiere ver las condiciones de todo el día, agregar una vista de 24 horas terrestres con un control de tiempo y ventanas estimadas, a partir de intervalos generados con el mismo método del comparador. Mostrar los límites y la resolución temporal del análisis.

**Criterio de cierre.** Ingresar manualmente el punto y el tiempo de una misión reproduce los resultados de referencia dentro de la tolerancia documentada. Cambiar solo el tiempo actualiza la iluminación y los ángulos. Un punto sin cobertura de relieve conserva los datos disponibles y muestra qué estimaciones están indeterminadas.

## Fase 9. Validación y publicación

- Verificar los tres escenarios Apollo, una consulta polar con relieve, una consulta sin cobertura local y entradas inválidas. Comprobar también el cambio de día en UTC, el sentido este/oeste, el cruce del azimut 0°/360° y los estados cerca del horizonte.
- Comprobar el render con la dirección solar conocida y una referencia independiente para al menos un instante. Definir y registrar tolerancias angulares y temporales según la resolución de los insumos. Registrar por separado la incertidumbre cerca de una transición.
- Revisar la demo en escritorio y móvil. Verificar que los controles y resultados sean utilizables con teclado y que los estados se identifiquen con texto. Mostrar créditos, metodología y cobertura en el sitio.
- Publicar con una escena histórica de entrada y preparar un recorrido breve. Abrir Apollo 11, cambiar a Apollo 14 y terminar con una consulta personalizada o una comparación polar validada.

**Criterio de cierre.** El enlace publicado abre las tres escenas, permite una consulta personalizada válida y presenta el resultado y sus fuentes. El repositorio incluye instrucciones para regenerar datos, ejecutar las comprobaciones y desplegar.

## Arquitectura y datos

| Capa | Responsabilidad |
|---|---|
| Procesamiento científico existente | Obtener efemérides, transformar marcos, preparar perfiles LOLA y calcular estados e intervalos. |
| Datos precalculados | Catálogo histórico, escenas Apollo y series del comparador. Incluir versión, escala temporal, marcos y referencias de origen. |
| Frontend React y TypeScript | Catálogo, globo, formulario, panel de condiciones y comparador. Consumir una misma respuesta de escena para actualizar el 3D y el panel. |
| Servicio de consultas | Resolver coordenadas y tiempos elegidos por el usuario, integrar efemérides y relieve, y entregar un resultado consistente con las escenas precalculadas. |

Una escena debe incluir sitio, instante, escala temporal, dirección solar en el marco lunar y, por cuerpo, azimut, elevación, ángulo de horizonte si existe y estado. Incluir procedencia, alcance y resolución del terreno. La línea de visión de la Tierra indica disponibilidad geométrica para comunicación directa. La luz solar visible indica una oportunidad de iluminación. La potencia eléctrica, la calidad del enlace y la evaluación de seguridad del aterrizaje requieren modelos adicionales.

**Orden de trabajo inmediato.** Validar la transformación de coordenadas y la dirección solar con Apollo 11, conectar ese caso al globo y al panel, y repetir con Apollo 12 y 14. Con los tres casos históricos como referencia, implementar el formulario personalizado y comprobar que reproduce las mismas condiciones para entradas equivalentes.
