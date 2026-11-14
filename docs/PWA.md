# Instalación PWA en Windows y Android

Publicación: https://javidez89.github.io/AppFinanza/ (los cambios de un PR se publican después de integrarlo en master).

## Instalar

- Windows: abrir el sitio en Microsoft Edge o Google Chrome. Usar «Instalar ahora» cuando aparezca, el icono de instalación de la barra de direcciones o la opción de instalar del menú. Abrir AppFinanza desde Inicio y comprobar que aparece en su propia ventana.
- Android: abrir el sitio directamente en Chrome. Usar «Instalar ahora» cuando aparezca o «Instalar aplicación» / «Añadir a pantalla de inicio» desde el menú. Abrir desde el icono creado y comprobar la ventana independiente.
- Si el enlace se abrió dentro de otra app, abrirlo en Chrome o Edge. La disponibilidad y el nombre del menú dependen del navegador. El botón directo aparece únicamente cuando el navegador entrega beforeinstallprompt; las instrucciones siguen disponibles sin ese evento.
- Si se cancela la instalación, se puede intentar nuevamente desde el menú. Cuando la app ya está instalada y se abre en modo standalone, se ocultan las instrucciones.

## Conexión y actualizaciones

La PWA requiere internet para autenticar y consultar o guardar movimientos. Después de una primera visita en línea y de activar el service worker, una navegación sin conexión muestra una página pública con «Reintentar». No ofrece edición sin conexión ni sincronización de movimientos.

El service worker no almacena páginas autenticadas, callbacks OAuth, respuestas de Supabase ni peticiones con parámetros. Solo conserva iconos, la página sin conexión y recursos de Next con nombres versionados, dentro del alcance de esta app. No reemplaza la gestión de sesión del cliente existente.

Una versión nueva queda en espera mientras haya ventanas de la versión anterior abiertas. El aviso «Actualizar app» pide guardar antes de recargar. Aceptar activa la versión nueva y recarga las ventanas controladas; cerrar todas las ventanas también permite activar la actualización.

En desarrollo no se registra el service worker. Para probarlo, usar una exportación de producción servida en localhost o HTTPS; no abrir los archivos mediante file:// ni usar next start con output: export.

## Validación automática

Ejecutar lint, typecheck, test y build. Repetir el build con NEXT_PUBLIC_BASE_PATH vacío y con /AppFinanza. CI verifica ambas configuraciones.

El postbuild valida id/start_url/scope, enlaces del manifest y metadata en todas las rutas, PNG reales de 192 y 512 píxeles y la página sin conexión. Reutilizamos los iconos existentes: sus iniciales están dentro de la zona segura central; ambos tamaños se declaran para usos any y maskable. El postbuild asigna al worker una versión derivada del contenido exportado para renovar la caché en cada publicación. Desplegar out/ completo, nunca copiar solo public/sw.js.

Las pruebas simulan el worker y verifican precarga, límites de alcance, navegación sin conexión, exclusión de datos privados, respuestas fallidas, limpieza de caché y activación solicitada por el usuario.

## Comprobación en dispositivos después del despliegue

Estas comprobaciones requieren el navegador y dispositivo reales; las validaciones de exportación no sustituyen la aceptación del navegador.

1. En Edge/Chrome de Windows y Chrome de Android, visitar la URL HTTPS. Comprobar en DevTools que el manifest no tiene errores, los iconos cargan y el worker está activado con alcance /AppFinanza/.
2. Aceptar y cancelar el diálogo de instalación en pruebas separadas. Comprobar que el botón no reutiliza un evento consumido y que las instrucciones permiten instalar desde el menú.
3. Abrir la app instalada: verificar título, icono, ventana standalone y navegación login/dashboard/auth/callback bajo /AppFinanza/. Verificar inicio de sesión con una cuenta autorizada.
4. Tras una visita en línea, desconectar y recargar dashboard y login. Debe aparecer «Estás sin conexión». Reconectar y pulsar «Reintentar».
5. Publicar una segunda versión con la app abierta. Guardar los cambios y aceptar «Actualizar app». Comprobar la recarga y eliminación de cachés anteriores de esta app; verificar que otras apps del mismo dominio conservan sus cachés.
6. Verificar el panel con teclado y en pantalla estrecha, y que las instrucciones se ocultan al abrir la app instalada.

Referencias: [criterios de instalación](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable) y [diálogo de instalación](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Trigger_install_prompt).
