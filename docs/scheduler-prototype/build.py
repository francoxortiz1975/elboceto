import re
css=open('style.css').read(); eng=open('engine.js').read(); ui=open('ui.js').read()
eng=eng.replace("if (typeof module !== 'undefined') module.exports = { defaultState, runEngine, buildGrid, placedSignature, slotLabel, freeHours, WEIGHTS, urgency };","")
html=f'''<title>Motor de planificación</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans+Condensed:wght@600;700&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
<style>
{css}
</style>
<div class="wrap">
  <header class="top">
    <div><div class="sub">El Boceto · prototipo con datos de ejemplo</div><h1>Motor de planificación</h1></div>
    <div class="spacer"></div>
    <button data-act="json">Configuración (JSON)</button>
    <button data-act="reset" class="ghost">Restablecer ejemplo</button>
  </header>
  <div id="jsonbox" hidden class="win" style="margin-bottom:14px"><h2><span>Configuración</span><button class="small" data-act="copy">Copiar</button></h2><div class="body"><textarea id="jsonta" class="json" readonly aria-label="Configuración en JSON"></textarea></div></div>
  <nav class="tabs" id="tabs" aria-label="Ventanas"></nav>
  <main id="panel"></main>
</div>
<script>
{eng}
{ui}
</script>
'''
open('motor.html','w').write(html)
print(len(html))
