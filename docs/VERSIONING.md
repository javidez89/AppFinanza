# Versionamiento y flujo de desarrollo

## Versiones

Usamos `MAYOR.MENOR.PARCHE`, siguiendo [SemVer](https://semver.org/lang/es/):

- Corrección compatible: subir PARCHE, por ejemplo `0.2.0` → `0.2.1`.
- Funcionalidad nueva compatible: subir MENOR y reiniciar PARCHE, por ejemplo `0.2.1` → `0.3.0`.
- Cambio incompatible con el contrato de una versión estable: subir MAYOR. Mientras estemos en `0.x`, un cambio incompatible requiere al menos incrementar MENOR y describir la migración; no se asume estabilidad `1.0.0` hasta declararla expresamente.

El contrato del producto incluye reglas de cálculo, formatos y semántica de datos, autenticación y flujos del usuario. El tipo de commit sirve como señal, pero la versión se decide por el efecto real del cambio.

`package.json` es la fuente del número de versión. `package-lock.json` debe coincidir tanto en su raíz como en `packages[""].version`. Usar `npm version <versión> --no-git-tag-version` para actualizar ambos sin crear un tag prematuro.

## Cada ajuste

1. Revisar el estado de trabajo y actualizar la referencia de `master`. Crear una rama corta por objetivo: `feat/descripcion`, `fix/descripcion` o `chore/descripcion`.
2. Implementar el cambio y añadir las pruebas necesarias. Usar [Conventional Commits](https://www.conventionalcommits.org/es/v1.0.0/): `feat(prestamos): ...`, `fix(pwa): ...`, `docs(versioning): ...`, `test(prestamos): ...` o `chore(release): ...`. Identificar cambios incompatibles con `!` y explicar el impacto.
3. Proponer el siguiente número de versión según la versión actual de `master`. Registrar en CHANGELOG qué cambió, qué se corrigió, cómo se validó y qué pasos de despliegue son necesarios. Marcar la versión «En preparación» mientras no esté publicada.
4. Abrir o actualizar el PR con versión propuesta, resultado esperado, validaciones y cambios de base de datos. Cada PR de producto incluye su versión; los ajustes dentro del mismo PR se identifican por commits y entradas del changelog, sin generar una release por commit.
5. Antes de integrar, actualizar la rama respecto a `master`, resolver conflictos y revisar otra vez la versión. Si otra rama publicó el número propuesto, elegir el siguiente; nunca integrar una versión igual o menor ni reutilizar un número ya publicado. No asignar el mismo número a dos releases distintas.
6. Ejecutar lint, typecheck, tests, build y `npm run version:check`; CI debe pasar. Las pruebas adicionales dependen del alcance (por ejemplo, SQL para una migración). Un cambio solo de documentación o pruebas puede conservar la versión del producto si no altera su comportamiento; registrar igualmente su propósito en los commits y en «Sin publicar» del changelog.

## Publicación

Aplicar las migraciones necesarias en el orden documentado, integrar el PR y esperar que el despliegue del commit integrado termine correctamente. No aplicar cambios de datos de forma automática por incrementar la versión.

Al preparar la publicación, sustituir «En preparación» por la fecha de la release y conservar las notas correspondientes a esa versión. Crear un tag anotado `vX.Y.Z` y una GitHub Release que apunten al commit publicado de `master`; incluir el SHA y las validaciones. Las notas preparadas no prueban por sí solas que una release exista. No crear tags ni releases sobre commits de ramas pendientes de integrar.

Las correcciones posteriores se publican con una nueva versión. No mover ni sobrescribir tags publicados. Para volver atrás, restaurar de forma controlada un commit conocido y considerar por separado la compatibilidad de la base de datos: volver al frontend anterior no revierte una migración.

## Estado inicial

La versión encontrada al adoptar esta política fue `0.1.0`; no se ha reconstruido un historial de releases anteriores. El PR de interés total propone `0.2.0` porque incorpora una modalidad nueva. La mejora PWA del PR #2 sigue en otra rama: al integrar cualquiera de los PR primero, ajustar la versión y el changelog del siguiente contra el nuevo `master`.
