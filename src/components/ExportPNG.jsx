import { useRef } from 'react';
import * as domtoimage from 'dom-to-image-more';

async function waitForImages(node) {
  const imgs = Array.from(node.querySelectorAll('img'));
  await Promise.all(
    imgs.map(async (img) => {
      try {
        if ('decode' in img) await img.decode();
        else if (!img.complete) {
          await new Promise((res) => {
            img.onload = () => res();
            img.onerror = () => res();
          });
        }
      } catch {}
    })
  );
}

export default function ExportPNG({
  targetId = 'tierboard',
  fileName = 'tierlist',
  scale = 2,
  bgColor = '#0b0b0d',
  className = "px-4 py-2 rounded font-bold bg-blue-600 text-white hover:bg-blue-500"
}) {
  const busy = useRef(false);

  const handleExport = async () => {
    if (busy.current) return;
    busy.current = true;

    const html = document.documentElement;
    html.classList.add('exporting'); // export 모드 켜기

    try {
      const node = document.getElementById(targetId);
      if (!node) throw new Error(`Target element not found: #${targetId}`);

      // data-export-hide 숨기기
      const hidden = [];
      node.querySelectorAll('[data-export-hide="true"]').forEach((el) => {
        const prev = el.style.visibility;
        hidden.push([el, prev]);
        el.style.visibility = 'hidden';
      });

      if (document.fonts?.ready) {
        try { await document.fonts.ready; } catch {}
      }
      await waitForImages(node);

      const width = Math.ceil(node.scrollWidth);
      const height = Math.ceil(node.scrollHeight);

      const dataUrl = await domtoimage.toPng(node, {
        bgcolor: bgColor,
        cacheBust: true,
        width: width * scale,
        height: height * scale,
        style: {
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          width: `${width}px`,
          height: `${height}px`,
        },
        filter: (el) => el?.getAttribute?.('data-export-hide') !== 'true',
      });

      hidden.forEach(([el, prev]) => (el.style.visibility = prev));

      const a = document.createElement('a');
      a.download = `${fileName}.png`;
      a.href = dataUrl;
      a.click();
    } catch (err) {
      console.error(err);
      alert('PNG 내보내기 오류 (콘솔 확인)');
    } finally {
      html.classList.remove('exporting');
      busy.current = false;
    }
  };

  return (
    <button
      type="button"
      onClick={handleExport}
      className={className}
    >
      PNG
    </button>
  );
}
