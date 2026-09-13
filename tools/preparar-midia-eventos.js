#!/usr/bin/env node
/* Converte a mídia crua dos eventos para formato web.  `npm run midia`
 *
 * Por que fica fora do `npm run build`: as pastas de origem vivem no Desktop,
 * fora do repositório, e não existem na máquina de build da Vercel. O que a
 * Vercel vê é o resultado já convertido e commitado em assets/eventos/.
 *
 * Preset copiado do que já está em produção na home: H.264 ~1000 kb/s, sem
 * faixa de áudio, faststart. As fontes são 4K/60fps HEVC com áudio estéreo;
 * sem conversão, um único arquivo pesaria mais que a página inteira.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const RAIZ = path.join(__dirname, '..');
/* As pastas de origem ficam dois níveis acima do site, em Marketing/. */
const ORIGEM = process.env.MIDIA_ORIGEM || path.join(RAIZ, '..');
const DESTINO = path.join(RAIZ, 'assets', 'eventos');

const curadoria = JSON.parse(fs.readFileSync(path.join(__dirname, 'midia-eventos.json'), 'utf8'));

const ff = (args) => execFileSync('ffmpeg', ['-v', 'error', '-y'].concat(args), { stdio: 'inherit' });

/* Caixa de 1280x1280 com aspecto preservado: retrato vira 720x1280, paisagem
   vira 1280x720. As fontes misturam as duas orientações, então fixar largura
   OU altura distorceria metade do acervo. force_divisible_by=2 porque H.264
   com yuv420p exige dimensão par. */
const ESCALA_VIDEO = 'scale=w=1280:h=1280:force_original_aspect_ratio=decrease:force_divisible_by=2';

function converterVideo(entrada, saida) {
  ff(['-i', entrada,
      '-t', '8',              // até 8s: é loop mudo de vitrine, não filme
      '-an',                  // sem áudio, como os vídeos que já estão na home
      '-vf', ESCALA_VIDEO,
      '-r', '30',
      '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
      '-b:v', '1000k', '-maxrate', '1400k', '-bufsize', '2000k',
      '-movflags', '+faststart',
      saida]);
}

function gerarPoster(video, saida) {
  ff(['-ss', '1', '-i', video, '-frames:v', '1',
      '-vf', 'scale=w=420:h=420:force_original_aspect_ratio=decrease:force_divisible_by=2',
      '-c:v', 'libwebp', '-quality', '80', saida]);
}

/* HEIC o ffmpeg não lê; o sips (nativo do macOS) decodifica para JPEG e o
   ffmpeg faz o resto. */
function converterFoto(entrada, saida) {
  const temp = path.join(DESTINO, '.temp.jpg');
  execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '92', entrada, '--out', temp], { stdio: 'ignore' });
  ff(['-i', temp,
      '-vf', 'scale=w=1200:h=1200:force_original_aspect_ratio=decrease:force_divisible_by=2',
      '-c:v', 'libwebp', '-quality', '80', saida]);
  fs.unlinkSync(temp);
}

const manifesto = {};

for (const slug of Object.keys(curadoria)) {
  const { origem, arquivos } = curadoria[slug];
  const pastaSaida = path.join(DESTINO, slug);
  fs.mkdirSync(pastaSaida, { recursive: true });
  manifesto[slug] = [];

  arquivos.forEach((nome, i) => {
    const entrada = path.join(ORIGEM, origem, nome);
    if (!fs.existsSync(entrada)) throw new Error(`origem não encontrada: ${entrada}`);

    const base = `${slug}-${i + 1}`;
    const ext = path.extname(nome).toLowerCase();

    if (ext === '.mov' || ext === '.mp4') {
      const mp4 = path.join(pastaSaida, `${base}.mp4`);
      const poster = path.join(pastaSaida, `${base}.webp`);
      converterVideo(entrada, mp4);
      gerarPoster(mp4, poster);
      manifesto[slug].push({ tipo: 'video', arquivo: `${base}.mp4`, poster: `${base}.webp` });
      console.log('  -> %s (%d KB)', `${slug}/${base}.mp4`, Math.round(fs.statSync(mp4).size / 1024));
    } else {
      const webp = path.join(pastaSaida, `${base}.webp`);
      converterFoto(entrada, webp);
      manifesto[slug].push({ tipo: 'imagem', arquivo: `${base}.webp`, poster: null });
      console.log('  -> %s (%d KB)', `${slug}/${base}.webp`, Math.round(fs.statSync(webp).size / 1024));
    }
  });
}

/* Fora de assets/eventos/: nada no site referencia este arquivo — é só um
   registro de curadoria para quem roda o `npm run midia` de novo — e aquela
   pasta é servida em produção, então um manifest.json órfão iria ao ar. */
fs.writeFileSync(path.join(__dirname, 'manifest-eventos.json'), JSON.stringify(manifesto, null, 2) + '\n');
console.log('\n%d cases, %d arquivos -> assets/eventos/',
  Object.keys(manifesto).length,
  Object.values(manifesto).reduce((n, m) => n + m.length, 0));
