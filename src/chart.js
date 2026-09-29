const COLORS = {
  entry: '#e69f00',
  stop: '#d55e00',
  target: '#009e73',
  live: '#fff',
  resistance: '#cc79a7',
  support: '#56b4e9',
};

export function createGoldChart(element, chartLibrary = globalThis.LightweightCharts) {
  if (!element || !chartLibrary) throw new Error('Lightweight Charts is unavailable.');
  const chart = chartLibrary.createChart(element, {
    autoSize: true,
    layout: { textColor: '#aeb8c4', background: { type: 'solid', color: '#121820' } },
    grid: { vertLines: { color: '#202833' }, horzLines: { color: '#202833' } },
    rightPriceScale: { borderColor: '#364352' },
    timeScale: { borderColor: '#364352', timeVisible: true, secondsVisible: false, rightOffset: 6, barSpacing: 9 },
    crosshair: { mode: chartLibrary.CrosshairMode.Normal },
  });
  const series = chart.addSeries(chartLibrary.CandlestickSeries, {
    upColor: '#0072b2', downColor: '#d55e00', borderVisible: false, wickUpColor: '#0072b2', wickDownColor: '#d55e00',
  });
  let tradeLines = [];
  let levelLines = [];
  let liveLine;

  const clear = (lines) => lines.forEach((line) => series.removePriceLine(line));
  const addLine = (price, color, title, style = chartLibrary.LineStyle.Dashed) => series.createPriceLine({
    price, color, lineWidth: 1, lineStyle: style, axisLabelVisible: true, title,
  });

  function setData(bars) { series.setData(bars); chart.timeScale().fitContent(); }
  function update(bar) { series.update(bar); }
  function setLevels(levels) {
    clear(tradeLines);
    tradeLines = [];
    if (Number.isFinite(levels?.entry)) tradeLines.push(addLine(levels.entry, COLORS.entry, 'ENTRY'));
    if (Number.isFinite(levels?.sl)) tradeLines.push(addLine(levels.sl, COLORS.stop, 'SL'));
    if (Number.isFinite(levels?.tp)) tradeLines.push(addLine(levels.tp, COLORS.target, 'TP'));
  }
  function setSupportResistance({ support = [], resistance = [] } = {}) {
    clear(levelLines);
    levelLines = [
      ...resistance.filter(Number.isFinite).slice(0, 3).map((price, index) => addLine(price, COLORS.resistance, `R${index + 1}`)),
      ...support.filter(Number.isFinite).slice(0, 3).map((price, index) => addLine(price, COLORS.support, `S${index + 1}`)),
    ];
  }
  function setLivePrice(price) {
    if (!Number.isFinite(price)) return;
    if (liveLine) series.removePriceLine(liveLine);
    liveLine = addLine(price, COLORS.live, 'LIVE', chartLibrary.LineStyle.Dotted);
  }
  function destroy() { chart.remove(); }
  return { chart, series, setData, update, setLevels, setSupportResistance, setLivePrice, destroy };
}
