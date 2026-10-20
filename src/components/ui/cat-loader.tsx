import type { CSSProperties } from 'react';

type CatLoaderProps = {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

const sizeScales = {
  sm: 0.3,
  md: 0.42,
  lg: 0.55,
} as const;

export function CatLoader({ size = 'md', className = '' }: CatLoaderProps) {
  return (
    <div
      className={`cat-loader inline-flex items-center justify-center text-orange ${className}`}
      style={{ '--cat-scale': sizeScales[size] } as CSSProperties}
      role="status"
      aria-label="Cargando"
    >
      <div className="cat-loader__stage" aria-hidden="true">
        <div className="paw"></div>
        <div className="paw"></div>
        <div className="shake">
          <div className="tail"></div>
          <div className="main">
            <div className="head"></div>
            <div className="body">
              <div className="leg"></div>
            </div>
            <div className="face">
              <div className="mustache_cont">
                <div className="mustache"></div>
                <div className="mustache"></div>
              </div>
              <div className="mustache_cont">
                <div className="mustache"></div>
                <div className="mustache"></div>
              </div>
              <div className="nose"></div>
              <div className="eye"></div>
              <div className="eye"></div>
              <div className="brow_cont">
                <div className="brow"></div>
                <div className="brow"></div>
              </div>
              <div className="brow_cont">
                <div className="brow"></div>
                <div className="brow"></div>
              </div>
              <div className="ear_l">
                <div className="inner"></div>
              </div>
              <div className="ear_r">
                <div className="outer"></div>
                <div className="inner"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <span className="sr-only">Cargando...</span>
      <style>{`
        @keyframes cat-loader-shake {
          50% { top: 6px; }
        }
        @keyframes cat-loader-shadow {
          50% { width: 110px; margin-left: -40px; }
        }
        @keyframes cat-loader-tail {
          50% { transform: rotate(38deg); }
        }
        @keyframes cat-loader-track {
          to { margin-left: 20px; }
        }
        @keyframes cat-loader-eye {
          50% { top: 2px; }
        }
        @keyframes cat-loader-mustache-l {
          50% { transform: rotate(-10deg); }
        }
        @keyframes cat-loader-mustache-r {
          0%, 100% { transform: rotateY(180deg) rotateZ(0); }
          50% { transform: rotateY(180deg) rotateZ(-10deg); }
        }
        @keyframes cat-loader-ear-l {
          50% { transform: rotate(-30deg); }
        }
        @keyframes cat-loader-ear-r {
          50% { transform: rotate(30deg); }
        }
        @keyframes cat-loader-paw-l {
          50% { left: 130px; top: 176px; }
          70% { top: 160px; }
        }
        @keyframes cat-loader-paw-r {
          25% { top: 160px; }
          50% { left: 88px; top: 176px; }
        }

        .cat-loader {
          position: relative;
          width: calc(188px * var(--cat-scale, 1));
          height: calc(260px * var(--cat-scale, 1));
          color: currentColor;
          overflow: hidden;
        }

        .cat-loader__stage {
          position: absolute;
          top: 0;
          left: 0;
          width: 188px;
          height: 260px;
          color: currentColor;
          transform: scale(var(--cat-scale, 1));
          transform-origin: top left;
        }

        .cat-loader__stage .paw {
          position: absolute;
          top: 176px;
          left: 88px;
          width: 20px;
          height: 80px;
          background: currentcolor;
          border-radius: 20px/0 0 80px 40px;
          transform: rotate(10deg);
          animation: cat-loader-paw-l 0.45s infinite linear;
        }

        .cat-loader__stage .paw:after {
          position: absolute;
          content: "";
          bottom: -5px;
          left: -4px;
          width: 20px;
          height: 26px;
          background: currentcolor;
          border-radius: 50%;
          transform: rotate(24deg);
        }

        .cat-loader__stage .paw:nth-child(2) {
          left: 130px;
          animation: cat-loader-paw-r 0.45s infinite linear;
        }

        .cat-loader__stage .shake {
          position: absolute;
          width: 100%;
          top: 0;
          animation: cat-loader-shake 0.45s infinite linear;
        }

        .cat-loader__stage:before {
          position: absolute;
          content: "";
          top: 100%;
          left: 50%;
          width: 130px;
          height: 30px;
          margin-left: -50px;
          margin-top: -20px;
          background: hsl(var(--muted-foreground) / 0.2);
          border-radius: 50%;
          animation: cat-loader-shadow 0.45s infinite linear;
          animation-delay: 0.225s;
        }

        .cat-loader__stage:after {
          position: absolute;
          content: "";
          top: 100%;
          left: 100%;
          width: 15px;
          height: 10px;
          margin-left: -30px;
          margin-top: -10px;
          background: hsl(var(--muted-foreground) / 0.15);
          border-radius: 50%;
          box-shadow: 50px 0 hsl(var(--muted-foreground) / 0.15),
                      100px 0 hsl(var(--muted-foreground) / 0.15),
                      150px 0 hsl(var(--muted-foreground) / 0.15),
                      200px 0 hsl(var(--muted-foreground) / 0.15),
                      250px 0 hsl(var(--muted-foreground) / 0.15),
                      300px 0 hsl(var(--muted-foreground) / 0.15);
          animation: cat-loader-track 0.225s infinite linear;
        }

        .cat-loader__stage .tail {
          position: absolute;
          content: "";
          top: 0;
          right: -4px;
          width: 160px;
          height: 150px;
          border: 20px solid;
          border-color: currentcolor transparent transparent currentcolor;
          transform: rotate(45deg);
          border-radius: 120px/106px 120px 0 120px;
          box-sizing: border-box;
          animation: cat-loader-tail 0.45s infinite linear;
        }

        .cat-loader__stage .tail:after {
          position: absolute;
          content: "";
          width: 20px;
          height: 20px;
          background: currentcolor;
          border-radius: 50%;
          bottom: 0;
          box-shadow: 2px 4px currentcolor, 2px 7px currentcolor, 2px 10px currentcolor,
                      1px 14px currentcolor, -1px 18px currentcolor, -5px 22px currentcolor,
                      -10px 25px currentcolor, -15px 28px currentcolor, -20px 30px currentcolor;
        }

        .cat-loader__stage .main {
          position: absolute;
          top: 14px;
          right: 0;
          width: 144px;
          height: 216px;
          color: currentcolor;
        }

        .cat-loader__stage .main .head {
          position: absolute;
          bottom: -10px;
          left: 20px;
          width: 104px;
          height: 180px;
          background: currentcolor;
          border-radius: 55px/100px 100px 65px 65px;
          transform: rotate(40deg);
        }

        .cat-loader__stage .main .body {
          position: absolute;
          right: 0;
          width: 130px;
          height: 180px;
          background: currentcolor;
          border-radius: 65px/70px 70px 100px 100px;
        }

        .cat-loader__stage .main .body .leg {
          position: absolute;
          right: -10px;
          top: 20px;
          width: 50px;
          height: 116px;
          background: currentcolor;
          border-radius: 25px/0 60px 50px 0;
        }

        .cat-loader__stage .main .body .leg:before {
          position: absolute;
          content: "";
          bottom: -4px;
          right: 0;
          width: 20px;
          height: 40px;
          border: 3px solid transparent;
          border-radius: 50%;
          border-left-color: hsl(var(--muted-foreground) / 0.3);
          transform: rotate(6deg);
        }

        .cat-loader__stage .main .body .leg:after {
          position: absolute;
          content: "";
          left: 3px;
          bottom: 35px;
          width: 76px;
          height: 70px;
          border-radius: 50%;
          border: 3px solid transparent;
          border-bottom-color: hsl(var(--muted-foreground) / 0.3);
          transform: rotate(65deg);
        }

        .cat-loader__stage .main .face {
          position: absolute;
          bottom: 0;
          width: 76px;
          height: 80px;
        }

        .cat-loader__stage .main .face .nose {
          position: absolute;
          bottom: 8px;
          left: 50%;
          width: 18px;
          height: 9px;
          margin-left: -10px;
          background: #9c1b4d;
          border-radius: 20px/10px 10px 20px 20px;
        }

        .cat-loader__stage .main .face .mustache_cont {
          position: absolute;
          bottom: 5px;
          width: 20px;
          height: 10px;
          animation: cat-loader-mustache-l 0.45s infinite linear;
        }

        .cat-loader__stage .main .face .mustache_cont:nth-child(2) {
          right: 0;
          animation: cat-loader-mustache-r 0.45s infinite linear;
        }

        .cat-loader__stage .main .face .mustache {
          position: absolute;
          top: 0;
          width: 100%;
          border: 1px solid hsl(var(--muted-foreground) / 0.5);
          transform-origin: 100% 0;
          transform: rotate(-10deg);
        }

        .cat-loader__stage .main .face .mustache:last-child {
          top: 6px;
          transform: rotate(-20deg);
        }

        .cat-loader__stage .main .face .eye {
          position: absolute;
          top: 28px;
          left: -8px;
          width: 30px;
          height: 30px;
          background: #fff;
          border: 3px solid currentColor;
          border-radius: 50%;
          box-sizing: border-box;
        }

        .cat-loader__stage .main .face .eye:nth-child(5) {
          top: 26px;
          left: 36px;
        }

        .cat-loader__stage .main .face .eye:after {
          position: absolute;
          content: "";
          width: 10px;
          height: 10px;
          right: 1px;
          top: 4px;
          background: currentColor;
          border-radius: 50%;
          animation: cat-loader-eye 0.45s infinite linear;
        }

        .cat-loader__stage .main .face .brow_cont {
          position: absolute;
          top: 14px;
          left: 10px;
          width: 10px;
          height: 10px;
        }

        .cat-loader__stage .main .face .brow_cont:nth-child(7) {
          transform: rotateY(180deg) rotateZ(0);
          left: 38px;
        }

        .cat-loader__stage .main .face .brow {
          position: absolute;
          top: 20%;
          height: 60%;
          border: 1px solid hsl(var(--muted-foreground) / 0.5);
          transform-origin: 100% 0;
          transform: rotate(10deg);
        }

        .cat-loader__stage .main .face .brow:last-child {
          top: 0;
          height: 100%;
          left: 6px;
          transform: rotate(3deg);
        }

        .cat-loader__stage .main .face .ear_l {
          position: absolute;
          top: -17px;
          width: 20px;
          height: 30px;
          background: currentcolor;
          border-radius: 20px/55px 55px 0 0;
          transform-origin: 50% 100%;
          overflow: hidden;
          transform: rotate(-20deg);
          animation: cat-loader-ear-l 0.45s infinite linear;
        }

        .cat-loader__stage .main .face .ear_l .inner {
          position: absolute;
          top: 5px;
          left: 50%;
          width: 6px;
          height: 14px;
          margin-left: -4px;
          background: hsl(var(--muted-foreground) / 0.3);
          border-radius: 7px/20px 20px 0 0;
        }

        .cat-loader__stage .main .face .ear_r {
          position: absolute;
          right: 0;
          margin-top: -22px;
          width: 36px;
          height: 30px;
          transform-origin: 50% 100%;
          overflow: hidden;
          transform: rotate(20deg);
          animation: cat-loader-ear-r 0.45s infinite linear;
        }

        .cat-loader__stage .main .face .ear_r .outer {
          position: absolute;
          width: 30px;
          height: 200%;
          border: 3px solid hsl(var(--muted-foreground) / 0.3);
          border-radius: 20px/55px 55px 0 0;
        }

        .cat-loader__stage .main .face .ear_r .inner {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 12px;
          height: 26px;
          margin-left: -6px;
          background: hsl(var(--muted-foreground) / 0.3);
          border-radius: 50%;
        }

        @media (prefers-reduced-motion: reduce) {
          .cat-loader__stage,
          .cat-loader__stage *,
          .cat-loader__stage::before,
          .cat-loader__stage::after {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
