# Plan del MVP de Lunar Landing Site Navigator

La primera entrega será un catálogo textual de misiones lunares con datos históricos verificables. Moon Trek sirve como referencia para el tipo de información que queremos consultar sobre cada sitio. La segunda entrega será una prueba técnica que combine el relieve lunar con las posiciones del Sol y la Tierra. Ambas etapas se pueden ejecutar con archivos JSON y scripts de consola.

## Etapa 1. Catálogo histórico verificable

El catálogo debe responder qué misión llegó a la Luna, cuándo alunizó, dónde lo hizo y qué fuentes respaldan esos datos. Empezaremos con tres alunizajes tripulados del programa Apollo. Estos registros sirven para validar el catálogo histórico. La prueba de visibilidad tendrá su propio sitio en el polo sur.

### Registros iniciales

| Misión | Sitio | Alunizaje (UT, según NSSDCA) | Latitud (° N) | Longitud (° E) | Ficha oficial |
|---|---|---|---:|---:|---|
| Apollo 11 | Mare Tranquillitatis | 1969-07-20 20:17:40 | 0.67416 | 23.47314 | [NASA NSSDCA](https://nssdc.gsfc.nasa.gov/planetary/lunar/apollo11info.html) |
| Apollo 12 | Oceanus Procellarum | 1969-11-19 06:54:35 | -3.0128 | -23.4219 | [NASA NSSDCA](https://nssdc.gsfc.nasa.gov/planetary/lunar/apollo12info.html) |
| Apollo 14 | Fra Mauro | 1971-02-05 09:18:11 | -3.64589 | -17.47194 | [NASA NSSDCA](https://nssdc.gsfc.nasa.gov/planetary/lunar/apollo14info.html) |

Las coordenadas corresponden al módulo lunar en la [tabla oficial de NASA NSSDCA](https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html), derivada de imágenes de Lunar Reconnaissance Orbiter. La referencia es planetocéntrica Mean Earth/Polar Axis (ME), con efeméride DE421. Los valores negativos representan sur y oeste respectivamente. Las fichas de misión muestran coordenadas redondeadas. También hay diferencias de un segundo entre fuentes para Apollo 11. El catálogo adopta la hora de NSSDCA y conserva la variante de 20:17:39 GMT del [resumen histórico de NASA](https://www.nasa.gov/wp-content/uploads/static/history/SP-4029/Apollo_11a_Summary.htm) como nota de procedencia.

### Datos y flujo de trabajo

1. Crear `data/missions.json` con un ID estable, nombre, tipo de misión, resultado, nombre del sitio y fecha y hora de alunizaje. Guardar la escala temporal reportada por la fuente, las coordenadas con sus unidades y marco de referencia, y la fecha de revisión.
2. Guardar una fuente por grupo de campos. Usar la ficha de misión para el evento y la tabla del módulo lunar para las coordenadas. Conservar el valor original y documentar cualquier normalización. Si un valor falta, usar `null` y registrar el motivo.
3. Ejecutar un validador que revise IDs únicos, rangos de latitud y longitud, fechas válidas y procedencia de cada campo publicado. La revisión documental debe confirmar que el evento fue el alunizaje y que las coordenadas identifican al módulo, con una nota cuando existan discrepancias entre fuentes.
4. Exponer una lista de misiones y una consulta por ID desde consola. Entregar el JSON y un informe breve de validación que indique qué fuente se consultó y qué campos se comprobaron.

**Criterio de aceptación.** Las tres fichas se pueden consultar desde consola. Cada fecha, sitio y par de coordenadas se puede rastrear hasta su fuente. El validador detecta registros incompletos y coordenadas fuera de rango. La revisión documental queda registrada y distingue las discrepancias de los errores de captura.

## Etapa 2. Prueba de visibilidad con LOLA y JPL Horizons

La prueba debe determinar si el relieve bloquea la vista del Sol o la Tierra desde un punto del polo sur lunar. Empezaremos con un único punto de prueba en una zona con cobertura LOLA, como el borde de Shackleton. Antes de ejecutar el cálculo, fijaremos sus coordenadas, la altura del observador, el periodo y el paso temporal. El punto se documentará como sitio de prueba del polo sur.

1. **Terreno.** Descargar un modelo digital de elevación LOLA del [archivo PDS](https://pds.nasa.gov/) a través de su [colección LOLA](https://pds-geosciences.wustl.edu/missions/lro/lola.htm), o usar el [producto polar de alta resolución de NASA GSFC](https://pgda.gsfc.nasa.gov/products/78). Registrar archivo, versión, proyección, resolución, referencia vertical y cobertura. Calcular la elevación angular máxima del terreno por azimut desde el observador, incorporando la curvatura lunar. Registrar el radio analizado y señalar sectores con cobertura insuficiente.
2. **Posiciones aparentes.** Consultar [JPL Horizons](https://ssd-api.jpl.nasa.gov/doc/horizons.html) para el Sol y la Tierra desde ese punto en la superficie lunar. Guardar fecha y hora, azimut y elevación sin refracción. Conservar parámetros y respuestas originales. Comprobar que longitud, latitud, marco de referencia y altura del observador sean compatibles con los del modelo de terreno antes de combinar las fuentes.
3. **Comparación.** Para cada instante y objeto, restar la elevación del horizonte del terreno, en el azimut del objeto, de la elevación del centro aparente del objeto. Si la diferencia es positiva, el centro está visible. Si es negativa, está oculto. La igualdad se reporta como contacto con el horizonte. Si la cobertura del terreno es insuficiente, reportar estado indeterminado.
4. **Ventanas.** Agrupar las muestras consecutivas con visibilidad y reportar sus límites estimados. Empezar con muestras cada hora y repetir cerca de los cruces con un paso menor. Una hora de muestreo puede omitir ventanas más breves. Exportar un CSV con los ángulos, la diferencia y el estado, más un resumen textual de las ventanas observadas.

### Pruebas de aceptación

| Caso | Entrada | Resultado esperado |
|---|---|---|
| Obstrucción | Sol a 2° y horizonte a 4° en el mismo azimut | Diferencia de −2°. Centro del Sol oculto. |
| Vista libre | Sol a 5° y horizonte a 4° en el mismo azimut | Diferencia de +1°. Centro del Sol visible. |
| Contacto | Tierra a 4° y horizonte a 4° en el mismo azimut | Diferencia de 0°. Contacto con el horizonte. |
| Cobertura insuficiente | Horizonte desconocido en el azimut del objeto | Estado indeterminado. |
| Datos reales | Un punto polar, un modelo LOLA identificado y una serie de Horizons para el Sol y la Tierra | CSV reproducible con las fuentes y parámetros registrados. Verificación manual de ejemplos a partir de los ángulos y una transición visible u oculta comprobada con un paso temporal menor. Si el rango inicial carece de transiciones, ampliarlo o elegir otro periodo. |

Los cuatro primeros casos son datos de prueba. El quinto evalúa la integración con fuentes reales. El resultado describe visibilidad geométrica del centro de cada objeto y sirve para estimar oportunidades de iluminación y de comunicación directa. El cálculo de potencia eléctrica y de calidad del enlace corresponde a modelos posteriores.
