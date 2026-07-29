# entender — el buscador que entiende lenguaje

Traduce lo que la persona escribió a las señales que las reglas ya saben
leer. Vive del lado del servidor porque la app es estática en GitHub
Pages: una clave de API en el front sería una clave publicada.

## La división del trabajo, y por qué

    el modelo ENTIENDE la frase     (es bueno con lenguaje desprolijo)
    las reglas ELIGEN la plantilla  (se pueden explicar cuando fallan)

Cuando la app dice "te sirve esta porque es para invitar y ya tenés
fecha", eso es verdad y se puede verificar leyendo el código. Si la
elección la hiciera el modelo, cuando falle no habría nada que mirar.

## Lo que el modelo NO puede hacer

No escribe copy. No inventa títulos. No elige plantillas. Devuelve un
`objetivo` de un vocabulario CERRADO de siete valores y, para el tema, un
pedazo textual de la frase.

Y no es una promesa, son dos candados:
1. **Salida estructurada** (`output_config.format`) — no puede devolver
   prosa aunque quiera.
2. **La aduana** (`validar()` en `src/lib/entender.js`) — el tema tiene que
   estar CONTENIDO en lo que la persona escribió. Un tema bien redactado
   que ella no dijo se descarta igual que uno delirado.

Verificado: `"Sumate a nuestro evento exclusivo"` y `"Desayuno de trabajo
con especialistas"` se descartan los dos, sobre la frase "necesito algo
para que se anoten al desayuno del jueves". El segundo es el caso que
importa: suena bien, y justamente por eso no puede pasar.

## Si el modelo no está

Cae a las reglas y el buscador funciona como el día anterior. Sin
internet, sin la función desplegada, con el modelo lento o caído: el peor
caso es el producto de ayer, nunca una pantalla muerta.
Verificado con la función SIN desplegar: `entender()` devuelve `null` en
567 ms y las reglas siguen contestando.

## Desplegarla

    npm i -g supabase
    supabase login
    supabase link --project-ref otdbwfoydofzwtkcgfqf
    supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
    supabase functions deploy entender --no-verify-jwt

`--no-verify-jwt` porque la app no tiene login: entra cualquiera del
equipo con la URL. Si algún día hay login, se saca.

## Lo que cuesta

Una llamada por búsqueda, con caché por frase y 500 ms de espera antes de
preguntar (no se le pregunta al modelo en cada tecla). Corre en `effort:
low` porque es clasificación, no razonamiento.
