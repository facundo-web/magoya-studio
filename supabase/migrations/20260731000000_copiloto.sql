-- ============================================================
-- MEMORIA DEL COPILOTO — bitácora, publicaciones, métricas, conversaciones
--
-- Facu: "que recuerde qué hizo, qué sirvió, qué salió la última vez, qué
-- está pasando en las redes de Magoya, si algunas piezas tienen más
-- impacto". Eso son estas cuatro tablas y nada más.
--
-- El modelo de datos es una cadena de tres eslabones, y está partido así
-- a propósito:
--   bitacora      → se hizo una pieza                (siempre existe)
--   publicaciones → esa pieza salió, en tal red      (puede no pasar nunca)
--   metricas      → esa publicación midió tanto      (puede no medirse nunca)
-- Separarlos es lo que permite decir "hicimos 26 piezas, salieron 9, y de
-- 3 tenemos números". Si fuera una sola tabla con columnas nulas, "no lo
-- publicamos" y "no cargamos el dato" se verían igual, y el copiloto
-- terminaría afirmando cosas que no sabe. La honestidad del resumen
-- empieza acá, en el esquema.
--
-- Nada de esto es el trabajo de nadie: las piezas viven en localStorage +
-- IndexedDB del navegador. Esto es telemetría. Si la base se cae, la app
-- sigue andando igual.
-- ============================================================

-- ------------------------------------------------------------
-- Se hizo una pieza.
-- ------------------------------------------------------------
create table if not exists public.bitacora (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  template_id text not null,
  format_id   text,
  objetivo    text,
  titulo      text,
  carrusel    boolean not null default false,
  autor       text
);

-- El resumen del copiloto siempre pide "lo último primero", nunca el medio.
create index if not exists bitacora_created_at_idx on public.bitacora (created_at desc);

-- ------------------------------------------------------------
-- Esa pieza salió a una red.
-- ------------------------------------------------------------
create table if not exists public.publicaciones (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  pieza_id     uuid references public.bitacora (id) on delete cascade,
  red          text not null,
  publicado_el date,
  url          text
);

create index if not exists publicaciones_pieza_id_idx on public.publicaciones (pieza_id);
-- El import de CSV matchea por red + fecha, fila por fila. Sin este índice
-- son 200 escaneos de tabla por cada export de LinkedIn.
create index if not exists publicaciones_red_fecha_idx on public.publicaciones (red, publicado_el);

-- ------------------------------------------------------------
-- Esa publicación midió tanto, tal día.
-- Hay una fila POR MEDICIÓN, no una por publicación: los números de una
-- pieza a los 3 días y a los 30 no son el mismo número, y pisar el
-- anterior sería perder la única serie de tiempo que vamos a tener.
-- ------------------------------------------------------------
create table if not exists public.metricas (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  publicacion_id uuid references public.publicaciones (id) on delete cascade,
  likes          integer,
  comentarios    integer,
  guardados      integer,
  alcance        integer,
  medido_el      date
);

create index if not exists metricas_publicacion_id_idx on public.metricas (publicacion_id);

-- ------------------------------------------------------------
-- Las conversaciones con el copiloto.
-- `turnos` es el array de mensajes crudo tal como lo maneja el loop del
-- cliente: guardarlo entero en jsonb evita tener que versionar un esquema
-- de mensajes que todavía se está moviendo.
-- `updated_at` lo escribe el cliente al guardar. No hay trigger a
-- propósito: una función más en la base es una cosa más que puede fallar
-- en silencio, y acá el dato es una comodidad, no una garantía.
-- ------------------------------------------------------------
create table if not exists public.conversaciones (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sesion     text not null,
  turnos     jsonb not null
);

create index if not exists conversaciones_sesion_idx on public.conversaciones (sesion);
create index if not exists conversaciones_updated_at_idx on public.conversaciones (updated_at desc);

-- ============================================================
-- RLS — mismo criterio que shares / comments / verdicts
--
-- Las políticas son ABIERTAS para anon. Por qué: Magoya Studio es un sitio
-- estático en GitHub Pages, no hay login ni backend propio, y la
-- publishable key viaja en el bundle porque tiene que viajar. Un candado
-- que la persona lleva en el bolsillo no es un candado; fingir lo
-- contrario sería peor que esto, porque nos haría creer que hay una
-- defensa donde no la hay.
--
-- Qué lo hace aceptable: acá no hay dato personal ni contenido de nadie.
-- Es telemetría de piezas de marketing propias — qué plantilla se usó, en
-- qué red salió, cuántos likes juntó. Lo peor que puede hacer un tercero
-- es ensuciarnos las estadísticas, y eso lo notamos.
--
-- Lo que sí achicamos: no hay política de UPDATE ni de DELETE en
-- bitacora, publicaciones ni metricas. Desde el cliente se puede escribir
-- y leer, pero no reescribir la historia ni borrarla. Son append-only.
-- La única con UPDATE es conversaciones, porque un chat crece.
-- ============================================================

alter table public.bitacora       enable row level security;
alter table public.publicaciones  enable row level security;
alter table public.metricas       enable row level security;
alter table public.conversaciones enable row level security;

create policy "bitacora lectura abierta" on public.bitacora
  for select using (true);
create policy "bitacora alta abierta" on public.bitacora
  for insert with check (true);

create policy "publicaciones lectura abierta" on public.publicaciones
  for select using (true);
create policy "publicaciones alta abierta" on public.publicaciones
  for insert with check (true);

create policy "metricas lectura abierta" on public.metricas
  for select using (true);
create policy "metricas alta abierta" on public.metricas
  for insert with check (true);

create policy "conversaciones lectura abierta" on public.conversaciones
  for select using (true);
create policy "conversaciones alta abierta" on public.conversaciones
  for insert with check (true);
create policy "conversaciones edicion abierta" on public.conversaciones
  for update using (true) with check (true);
