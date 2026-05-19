import { createElement, forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { CSSProperties } from "react";
import { BandwidthGrapherEngine } from "../core/BandwidthGrapherEngine";
import type {
  BandwidthDataMode,
  BandwidthGrapherUserOptions,
  BandwidthPoint,
  BandwidthRange,
  BandwidthSetDataOptions,
} from "../core/types";

export type BandwidthGrapherRef = {
  setData: (points: BandwidthPoint[], options?: BandwidthSetDataOptions) => void;
  appendPoint: (point: BandwidthPoint) => void;
  pushTimeout: (time?: Date) => void;
  setMode: (mode: BandwidthDataMode) => void;
  setRange: (start: BandwidthRange["start"], end: BandwidthRange["end"]) => void;
  resetRange: () => void;
  fitDataRange: () => void;
  zoomIn: (anchor?: Date | number | string) => void;
  zoomOut: (anchor?: Date | number | string) => void;
  panPercent: (percent: number) => void;
  setOptions: (options: BandwidthGrapherUserOptions) => void;
  resize: () => void;
  exportImage: (type?: string, quality?: number) => string;
  destroy: () => void;
  getEngine: () => BandwidthGrapherEngine | null;
};

export type BandwidthGrapherProps = {
  points?: BandwidthPoint[];
  mode?: BandwidthDataMode;
  range?: BandwidthRange | "data" | null;
  followLive?: boolean;
  options?: BandwidthGrapherUserOptions;
  className?: string;
  style?: CSSProperties;
  onReady?: (engine: BandwidthGrapherEngine) => void;
};

export const BandwidthGrapher = forwardRef<BandwidthGrapherRef, BandwidthGrapherProps>(function BandwidthGrapher(
  { points, mode = "history-live", range, followLive, options = {}, className, style, onReady },
  ref,
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<BandwidthGrapherEngine | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const engine = new BandwidthGrapherEngine(containerRef.current, options);
    engine.setMode(mode);
    engineRef.current = engine;
    onReady?.(engine);

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    engineRef.current?.setOptions(options);
  }, [options]);

  useEffect(() => {
    engineRef.current?.setMode(mode);
  }, [mode]);

  useEffect(() => {
    if (!engineRef.current || !points) return;

    engineRef.current.setData(points, {
      mode,
      followLive,
      range: range ?? undefined,
    });
  }, [points, mode, followLive, range]);

  useEffect(() => {
    if (!engineRef.current || points) return;

    if (range && range !== "data") {
      engineRef.current.setRange(range.start, range.end);
    } else if (range === null) {
      engineRef.current.resetRange();
    }
  }, [range, points]);

  useImperativeHandle(ref, () => ({
    setData: (nextPoints, dataOptions) => engineRef.current?.setData(nextPoints, dataOptions),
    appendPoint: (point) => engineRef.current?.appendPoint(point),
    pushTimeout: (time) => engineRef.current?.pushTimeout(time),
    setMode: (nextMode) => engineRef.current?.setMode(nextMode),
    setRange: (start, end) => engineRef.current?.setRange(start, end),
    resetRange: () => engineRef.current?.resetRange(),
    fitDataRange: () => engineRef.current?.fitDataRange(),
    zoomIn: (anchor) => engineRef.current?.zoomIn(anchor),
    zoomOut: (anchor) => engineRef.current?.zoomOut(anchor),
    panPercent: (percent) => engineRef.current?.panPercent(percent),
    setOptions: (nextOptions) => engineRef.current?.setOptions(nextOptions),
    resize: () => engineRef.current?.resize(),
    exportImage: (type, quality) => engineRef.current?.exportImage(type, quality) ?? "",
    destroy: () => engineRef.current?.destroy(),
    getEngine: () => engineRef.current,
  }));

  return createElement("div", {
    ref: containerRef,
    className,
    style: {
      width: "100%",
      height: "100%",
      ...style,
    },
  });
});
