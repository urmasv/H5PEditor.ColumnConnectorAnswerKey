# H5PEditor.ColumnConnectorAnswerKey

Redaktori kaaslasteek (vidin) sisutüübile
[H5P.ColumnConnector](https://github.com/urmasv/H5P.ColumnConnector) („Connect
with Lines”). Ei ole iseseisvalt käivitatav (`runnable: 0`).

## Mida see teeb

- Pakub iga lahtri jaoks välja **„Õiged ühendused eelmise tulbaga/reaga”**
  vidina (`columnConnectorCellConnections`): märkeruutude ripploend eelmise
  tulba/rea lahtritega, mille valik salvestatakse 1-põhiste indeksite
  JSON-massiivina.
- Lahendab lahtri asukoha (mitmes tulp/rida) redaktori välja-instantside puust,
  DOM on varuvariandiks.
- Redaktorivormi kohandused: sunnib „Käitumisseaded” rühma pealkirja; eemaldab
  tulpade loendi liigse „Collapse all content” juhtnupu; sünkroonib tulba/rea
  sõnavara valitud paigutusega (tulbad ↔ read); klapib tulbad/read ja lahtrid
  vaikimisi kokku; kuvab „Lisa pilt” alamväljad lamedalt.

## Sõltuvus

Kasutatakse `H5P.ColumnConnector` `library.json` → `editorDependencies` kaudu.
Repo juur ongi teegi juur; ehitamist pole vaja.

## Litsents

MIT — vt [LICENSE](LICENSE).

## Autorid

Autor ja hooldus: UrmasV.
