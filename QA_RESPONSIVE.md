# Evidencia de calidad y pruebas responsive — SmartStock

Fecha de revisión: 29 de octubre de 2026  
Versión revisada: Expo SDK 58 / React Native 0.88

## Verificaciones automáticas

| Prueba | Comando | Resultado |
|---|---|---|
| Tipos de TypeScript | `npm run typecheck` | Aprobada, sin errores |
| Reglas de ESLint | `npm run lint` | Aprobada, sin errores |
| Compatibilidad de Expo | `npm run doctor` | 20/20 comprobaciones aprobadas |
| Bundle de iOS | `npx expo export --platform ios` | Aprobado |
| Bundle web | `npx expo export --platform web` | Aprobado; 17 rutas generadas |
| Sintaxis de pruebas RLS | `node --check scripts/test-rls.mjs` | Aprobada |
| Residuos de SQLite | búsqueda en código y configuración | Sin coincidencias |

## Matriz responsive

| Escenario | Cobertura implementada | Estado |
|---|---|---|
| iPhone con isla dinámica/notch | `SafeAreaView`, encabezados opacos y barra de estado controlada | Aprobado por código y bundle |
| Teclado al editar productos | `KeyboardAvoidingView` y contenido desplazable | Aprobado por código y bundle |
| Teléfono angosto | tarjetas a una columna, contenido flexible y menú lateral al 88% | Aprobado por código |
| Tableta | tarjetas en dos columnas y límites de ancho | Aprobado por código |
| Escritorio ancho | panel administrativo con barra lateral y cuatro columnas | Aprobado por código y bundle web |
| Navegación interna | menú global adaptado al rol en todos los módulos internos | Aprobado |
| Cierre de sesión | disponible desde inicio y menú global | Aprobado |

## Prueba manual recomendada antes de la entrega

Realizar una última comprobación en un iPhone y un Android físicos:

1. Iniciar sesión como administrador y abrir cada módulo desde el menú global.
2. Iniciar sesión como cliente y confirmar que no aparezcan accesos administrativos.
3. Abrir el teclado al crear y editar un producto; comprobar que el campo activo y los botones sigan visibles.
4. Rotar el dispositivo si se habilita orientación horizontal en una versión futura.
5. Probar con texto grande del sistema para verificar accesibilidad.

La prueba manual en dispositivos reales complementa, pero no sustituye, las verificaciones automáticas anteriores.
