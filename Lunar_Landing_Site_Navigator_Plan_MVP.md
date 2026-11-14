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

# Lunar Landing Site Navigator — Etapas 3 y 4

El catálogo histórico y la prueba de visibilidad con LOLA y JPL Horizons ya están implementados. Las etapas 3 y 4 reutilizan ese cálculo para analizar tres puntos del polo sur lunar y comparar escenarios desde consola. Los entregables son datos estructurados, reportes textuales y casos reproducibles.

## Etapa 3. Ampliar el análisis a tres sitios

**Objetivo.** Generar resultados comparables para el punto polar ya probado y dos puntos adicionales con cobertura LOLA. Al menos dos de los tres puntos deben estar lo bastante cerca como para explorar el efecto del relieve local.

### Tareas

1. **Registrar los sitios.** Asignar un ID estable a cada punto y documentar nombre, latitud, longitud, marco de referencia y origen de las coordenadas. Identificar los puntos como sitios de análisis y conservar el catálogo histórico de alunizajes como referencia independiente.
2. **Fijar la configuración común.** Usar el mismo periodo de análisis, paso temporal inicial y altura del observador sobre el terreno. Registrar por sitio el modelo LOLA, su resolución, el radio analizado y la cobertura angular. Si hay diferencias de cobertura o resolución, hacerlas visibles en el resultado.
3. **Reutilizar el cálculo de la etapa 2.** Generar el perfil de horizonte por sitio y obtener las series del Sol y la Tierra desde ese mismo punto. Conservar los parámetros y respuestas de Horizons. Usar la misma regla de visibilidad y el mismo método de refinamiento de cruces para todos los sitios.
4. **Exportar resultados con un formato común.** Guardar por sitio un JSON con la configuración, la procedencia, las muestras y los intervalos por objeto. Reutilizar el CSV de la etapa 2 para revisar los valores individuales.
5. **Preparar un caso de comparación.** Buscar un instante en que el Sol esté visible desde un punto y oculto por el relieve desde otro. Guardar para ambos sitios la hora, el azimut, la elevación del Sol y el ángulo del horizonte en esa dirección.

### Datos mínimos

| Bloque | Campos |
|---|---|
| Sitio | ID, nombre, coordenadas, marco de referencia y fuente. |
| Configuración | Inicio y fin, escala temporal, paso inicial, altura del observador, modelo LOLA, radio, resolución y método de refinamiento. |
| Muestra | Fecha y hora, objeto, azimut, elevación, ángulo del horizonte, diferencia angular y estado. |
| Intervalo | Objeto, estado, inicio y fin estimados, y precisión temporal disponible. |
| Procedencia | Referencia al perfil de horizonte, producto de terreno y parámetros o respuesta original de Horizons. |

**Criterios de aceptación**

- Un comando procesa los tres sitios con una configuración común y genera resultados reproducibles a partir de los insumos registrados.
- Es posible rastrear una muestra de cualquier sitio hasta el perfil de horizonte y la consulta de Horizons que la originaron.
- La cobertura insuficiente se reporta como estado indeterminado. El caso de contraste entre dos sitios queda respaldado por ángulos y fuentes.

## Etapa 4. Comparar sitios y fechas desde consola

**Objetivo.** Responder cuánto cambia la visibilidad estimada al mover el sitio o cambiar la fecha de una misión.

### Modos de comparación

| Modo | Escenario A | Escenario B |
|---|---|---|
| Comparar sitios | Sitio A durante el periodo seleccionado | Sitio B durante ese mismo periodo |
| Comparar fechas | Un sitio durante el periodo A | El mismo sitio durante un periodo B de igual duración |

### Métricas del reporte

| Métrica | Cálculo |
|---|---|
| Horas con el Sol visible | Suma de los intervalos de visibilidad solar dentro del periodo. |
| Horas con la Tierra visible | Suma de los intervalos de visibilidad de la Tierra dentro del periodo. |
| Mayor interrupción continua | Duración máxima de un intervalo oculto, por separado para el Sol y la Tierra. |
| Horas con visibilidad simultánea | Duración de la intersección de las ventanas visibles del Sol y la Tierra. |
| Tiempo indeterminado | Duración con datos insuficientes, por objeto y escenario. |

### Tareas y reglas

1. Aceptar IDs de sitio y rangos de fechas. Validar que existan datos para el rango pedido y que los periodos comparados tengan la misma duración. Si el rango excede la cobertura temporal disponible, devolver un error que indique qué fechas se pueden consultar.
2. Recortar los intervalos a los límites del periodo antes de sumar duraciones. Contabilizar por separado los tramos indeterminados dentro del rango y evitar unir interrupciones a través de esos tramos. Conservar el estado de contacto con el horizonte de la etapa 2.
3. Generar un resumen lado a lado en texto y una salida JSON con ambos escenarios, valores, diferencia B − A, cobertura y fuentes. Indicar cuándo una interrupción toca el inicio o fin del rango, ya que su duración total puede extenderse fuera del periodo analizado.
4. Verificar el comparador con intervalos conocidos para cubrir recortes, visibilidad simultánea y huecos. Repetir la verificación con las series reales de la etapa 3.

**Criterios de aceptación**

- Se reproducen dos casos con datos reales. En uno cambia el resultado al cambiar de sitio. En el otro cambia al mover la fecha en un mismo sitio.
- Los totales del reporte coinciden con los intervalos recortados. El tiempo indeterminado aparece por separado y el solapamiento se cuenta una sola vez.
- El reporte identifica sitio, rango, fuentes y cobertura de cada escenario. Las métricas se presentan como visibilidad geométrica del centro del Sol y de la Tierra.

**Orden de implementación.** Procesar primero el segundo punto con el mismo periodo del punto original, verificar el contraste entre ambos y agregar el tercer punto. Después implementar los dos modos de comparación y guardar un ejemplo reproducible de cada uno.