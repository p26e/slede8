# SLEDE8

## Introduksjon

Det finnes totalt 16 8-biters registre, `r0..r15`. 
Her kan du mellomlagre data som skal behandles.
I tillegg benyttes et flagg som representerer resultatet av sammenligningsoperasjoner, og som er bestemmer om programmet skal utføre betingede hopp.

Tilgjengelig minne er 4096 bytes, med adressene `0..4095`.
Programmer lastes inn fra addresse 0, slik at første instruksjon alltid vil ha addresse 0.

SLEDE8 forholder seg til binærdata som little endian.

## Gramatikk

Programmer skrives med s8-assembly (`.s8asm`) og monteres til binærfiler (`.s8`).
I s8-assembly kan en linje være en  `merkelapp`, `instruksjon`, `data` eller en `kommentar`.
Kommentarer kan også legges til etter en `instruksjon`.
Blanke linjer blir ignorert.

### Kommentarer

En `kommentar` begynner tegnet `;`.
Kommentarer blir ignorert når programmet monteres.

Eksempel ([prøv selv](https://slede8.npst.no#N4Igzg9grgTgxgUwMIQCYJALhAbgAQIB2eA1hALblEAuAhjADqEByA8gAoCie+RethQnzKUa9JgGUAKh3YgANCACWhAA5RqWECAC+QA)):

```
; en kommentar
NOPE ; en annen kommentar
```

### Merkelapper

En `merkelapp` er en linje på formen `^[0-9a-zA-ZæøåÆØÅ\-_]+:$`.
Merkelapper er referanser til addressen til den påfølgende instruksjonen eller dataen i koden.
De kan benyttes som argument ved hopp eller hvis man skal ta en tur.

For eksempler, se avsittet om programflyt.


### Instruksjoner

Følgende `instruksjoner` er tilgjengelig:


#### `SETT rA, rB`

Skriv verdien i rB til rA.


#### `SETT rA, <verdi>`

Skriv verdien til register `rA`.
Verdier skrives på formen `0xNN` eller `NN`.
De mest signifikante bitene (msb) blir skrevet til r1, mens de minst signifikante bitene (msb) blir skrevet til r0.


#### `NOPE`

Ikke gjør noe som helst.


#### `STOPP`

Avslutt programmet.


### Aritmetisk Logisk Enhet

ALE-operasjoner tar to registere som argument. 
Resultatet skrives til det første registeret.

- `OG rA, rB`
- `ELLER rA, rB`
- `XELLER rA, rB`
- `VSKIFT rA, rB`
- `HSKIFT rA, rB`
- `PLUSS rA, rB`
- `MINUS rA, rB`

**OBS**: Aritmetiske operasjoner er modulo 0x100.

Eksempel ([prøv selv](https://slede8.npst.no#N4Igzg9grgTgxgUwMIQCYJALhAZQKIAqBABDAAwA0xAjAEwAcxTA3KWcQLw0PEAUZAD3pkAlAB0AdviKlqVQQCMmxVjGqcm1dfwFkF4iZIAKAGQCqOHGyprlq9l3LEA1LMkBZAJIA5C9dl2bBpOALRuEgDyAOL+tsosQY7sAGTheCYmeABKseoJTknEAD7hABrpmTnkNnn2wewAeuEAajgA0p4AYiTVASqJQQA8g+EAEu1dPZR9dYUAfHPhkjgEEUZGIBQgAJYSAA5QAC5YICAAvkA)):

```
SETT r0, 128   ; r0 = 128 (0x80)
SETT r1, 0xb   ; r1 =  11 (0x0b)

PLUSS r0, r1   ; r0 = r0 + r1
MINUS r0, r1   ; r0 = r0 - r1
OG r0, r1      ; r0 = r0 & r1
ELLER r0, r1   ; r0 = r0 | r1
XELLER r0, r1  ; r0 = r0 ^ r1
VSKIFT r0, r1  ; r0 = r0 << r1
HSKIFT r0, r1  ; r0 = r0 >> r1

STOPP
```

### Sammenligning

Sammenligningsoperasjoner tar to registere som argument.
Resultatet persisteres i `flag` frem til neste sammenligningsoperasjon.

- `LIK rA, rB`
- `ULIK rA, rB`
- `ME rA, rB`
- `MEL rA, rB`
- `SE rA, rB`
- `SEL rA, rB`

Eksempel ([prøv selv](https://slede8.npst.no#N4Igzg9grgTgxgUwMIQCYJALhAZQKIAqBABDAAwA0xArMXQNylnEC8NAOgHb5GkCMVPs2KMYfVsSFcuAGQCSAaSZUxdEU1ZtVLAHzEAZgBsAhgHMJzABT7jhsAgCUXAKryl5FePXliAQi3iugYm5mzilgAuMFCOXACyeMr8at7MADx02npGZhLhUTFOnAkySaoMGmkBrNkhecSR0bHciR7JaqLMeslBOaHEVjZ2zfilbeWpxDrVvXVsg7b2RVw4BADyAAobIBQgAJacAA5QEVggIAC+QA)):

```
SETT r0, 5   ; r0 = 5
SETT r1, 10  ; r1 = 10

LIK r0, r1   ; r0 == r1 => flag = 0 (false)
ULIK r0, r1  ; r0 != r1 => flag = 1 (true)
ME r0, r1    ; r0 <  r1 => flag = 1 (true)
MEL r0, r1   ; r0 <= r1 => flag = 1 (true)
SE r0, r1    ; r0 >  r1 => flag = 0 (false)
SEL r0, r1   ; r0 >= r1 => flag = 0 (false)

STOPP
```


### Programflyt

Noen ganger ønsker man å gjøre mer enn å kjøre hver instruksjon én gang fra top til bunn.
SLEDE8 dekker dette behovet ved å støtte to typer hopp.

- `HOPP adresse`
- `HOPP merkelapp`
- `BHOPP adresse`
- `BHOPP merkelapp`

En `HOPP` operasjon hopper til den valgte adressen, mens `BHOPP` kun hopper hvis flagget er satt til 1 etter en tidligere sammenligningsoperasjon.

**Merk**: En merkelapp er kun en referanse til en adresse, og vil derfor bli erstattet med en adresse i den monterte binærfila. 
Det kan likevel være enklere som utvikler å forholde seg til merkelapper.

**Merk**: Man kan hoppe både oppover og nedover i koden.


Eksempel ([prøv selv](https://slede8.npst.no#N4Igzg9grgTgxgUwMIQCYJALhAZQKIAqBABDAAwA0xZxA3KTQLzUA6AdvkaQIxXd09izbu3YAZAJIBpBlRj9iipQPJDm8oQD5iAMwA2AQwDmQ6sQAUOg3rAIAlOwBCACQDyABXfEAtghgBrBEMAB2CyfnoACwhQv2IAS39AqjB49DZdQxNmMnFpWQZlZXpVRnUmbX1jU35zABcYKHsnN08fP0CQsIjiaNDiOvi9doCgg1Dw4lT0zOqy4hEOAg8vIrWBdLYEBLYwBqh-MAArCC2MgCM9eJhemOCEOuIIADc-UTZfUa7wzHZWr0+nXGYQATIooncBkMRkCJiD2Dhlm11kV6JttvFdvtDiczsRLtdbrFHi83mx2ICxnDfksVijUcRgjAIEYYAZvL5Hns7nFImT3iAKCBMcEoHUsCAQABfIA)):

```
SETT r0, 0 ; r0 = 0
SETT r1, 1 ; r1 = 1

LIK r0, r1        ; r0 == r1 => flag = 0 (false)
BHOPP merkelapp01 ; hopper ikke, siden flag = 0
LIK r0, r0        ; r0 == r0 => flag = 1 (true)
BHOPP merkelapp01 ; hopp til merkelapp01 siden flag == 1
STOPP             ; denne instruksjonen blir hoppet over

merkelapp01:
HOPP merkelapp02  ; hopp til merkelapp02
STOPP             ; denne instruksjonen blir hoppet over

merkelapp02:
STOPP             ; programmet stopper her
```

### Føde og oppgulp

Man kan gi programmet føde ved å benytte instruksjonen `LES rN`. 
Dette flytter første ikke-konsumerte byte med føde inn i det valgte registeret, men forutsetter at det er føde igjen.
Programmet slutter å samarbeide hvis det oppdager at det har gått tom for føde.

Programmet kan gi oppgulp ved å benytte instruksjonen `SKRIV rN`.
Verdien i det valgte registeret blir da spyttet ut.

**Merk**: Man behøver ikke konsumere føde for å produsere oppgulp!

**Merk**: På [slede8.npst.no](slede8.npst.no) presenteres føde til programmet som en hex-streng. 

Eksempel ([prøv selv](https://slede8.npst.no#N4Igzg9grgTgxgUwMIQCYJALhAbgASpR4DWAhgHZ4LmowJ4DyADkwOZQA2TeALgJYc8AU7wA3PmHoBBAMpIAkvIC0ohDFR81AHXL5VqYbxgBPYsXpMRU0kuLlSLagDodOmQFEAKp7wwADAA0eH4AHgAsAIx4ePj+eAC8weERbgDSAEryAGq+ftH50fhgxDB8okmReAAUAORSNQCUOgAy7jK5BZ2xeYmhkWmZOXGdMXjFpeV9AEzVNQBCjS1tHSOFHb3hAMwD2StdYyVlFZuzSIvkMp4MAArXq-n4pKJgHFA8PHgAZgAfMGJ8eFYQj+PAgAFsvhA-j90CAAiA+OQmG8sCAwlMwpsQABfIA)):

```
; med føde lik '4243' gulper dette opp 'ABC'

SETT r0, 0x41  ; r0 = 0x41
SKRIV r0       ; skriv 0x41 ('A')
LES r0         ; r0 = 0x41
SKRIV r0       ; skriv 0x42 ('B')
LES r0         ; r0 = 0x43
SKRIV r0       ; skriv 0x43 ('C')
STOPP          ; avslutt før vi går tom for føde
```


### Funksjoner

Man kan ta en tur til en adresse eller merkelapp ved å benytte funksjonen `TUR adresse`
Når man er lei av å være på tur kan man returnere til avreiseadressen ved å benytte instruksjonen `RETUR`

**Merk**: Merkelapper kan også benyttes som argument når man tar en `TUR`.

#### `FINN <merkelapp | adresse>`

Skriv adressen til merkelappen til r0 og r1. Mest signifikante bit (msb) skrives til r1, og minst signifikante bit (msb) skrives til r0.
Hvis addressen er `0xABC` blir dermed `r0` satt til `0xBC` og `r1` til `0x0A`.

#### `LAST rN`

Skriv verdien fra addressen `((r1 << 8) | r0) & 0x0FFF` til registeret `rN`.

#### `LAGR rN`

Skriv verdien i registeret rN til addressen `((r1 << 8) | r0) & 0x0FFF`.
    

### Data

Man kan representere `data` ved å skrive linjer formen `^.DATA [x0-9a-fA-F, ]*$`. 
For å skrive inn data (ev. instruksjonsbytes) bruker man altså ".DATA" etterfulgt av en komma-separert liste med tall. 
Typisk vil man også putte en `merkelapp` rett før.

Man får mest glede av denne muligheten hvis den benyttes sammen med `FINN` og `LAST`.

Eksempel:

```
MinStreng:
.DATA 0x48,0x65,0x6c,0x6c,0x6f,0x2c,0x20,0x77,0x6f,0x72,0x6c,0x64
```
