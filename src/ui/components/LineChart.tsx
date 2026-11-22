import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';

import { layoutChart, yLabelWidth } from '../../domain/chart';
import { formatE1rm } from '../../domain/oneRepMax';

export interface LineChartPoint {
  /** value in centi-kg */
  value: number;
  /** x label shown only for the first and last point */
  label: string;
}

const HEIGHT = 200;
const RIGHT = 36; // room for half of the last x label
const TOP = 12;
const BOTTOM = 32; // room for the x labels
const FONT = 11;
const LABEL_GAP = 6; // between the y labels and the axis

/** D9: minimal line chart on react-native-svg. Plots one value per point, x evenly spaced. */
export function LineChart({ points }: { points: LineChartPoint[] }) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.floor(e.nativeEvent.layout.width));

  // Y labels are e1RM values: D7 formatting (one decimal), via the domain helper.
  const values = points.map((p) => p.value);
  const maxLabel = values.length > 0 ? formatE1rm(Math.max(...values)) : '';
  const minLabel = values.length > 0 ? formatE1rm(Math.min(...values)) : '';
  // Room left of the axis sized to the longest label, so it is never clipped.
  const LEFT = yLabelWidth([maxLabel, minLabel], FONT, LABEL_GAP + 4);

  const innerWidth = Math.max(0, width - LEFT - RIGHT);
  const innerHeight = HEIGHT - TOP - BOTTOM;
  const layout = layoutChart(values, { left: LEFT, top: TOP, width: innerWidth, height: innerHeight });
  const last = points.length - 1;

  return (
    <View style={styles.box} onLayout={onLayout}>
      {width > 0 ? (
        <Svg width={width} height={HEIGHT}>
          <Line x1={LEFT} y1={TOP} x2={LEFT} y2={TOP + innerHeight} stroke="#bbb" strokeWidth={1} />
          <Line
            x1={LEFT}
            y1={TOP + innerHeight}
            x2={LEFT + innerWidth}
            y2={TOP + innerHeight}
            stroke="#bbb"
            strokeWidth={1}
          />
          <SvgText x={LEFT - LABEL_GAP} y={TOP + 4} fontSize={FONT} fill="#555" textAnchor="end">
            {maxLabel}
          </SvgText>
          <SvgText
            x={LEFT - LABEL_GAP}
            y={TOP + innerHeight}
            fontSize={FONT}
            fill="#555"
            textAnchor="end"
          >
            {minLabel}
          </SvgText>
          <Polyline
            points={layout.points.map((p) => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke="#0a7ea4"
            strokeWidth={2}
          />
          {layout.points.map((p, i) => (
            <Circle key={i} cx={p.x} cy={p.y} r={3.5} fill="#0a7ea4" />
          ))}
          {last >= 0 ? (
            <SvgText
              x={layout.points[0].x}
              y={HEIGHT - 10}
              fontSize={11}
              fill="#555"
              textAnchor="start"
            >
              {points[0].label}
            </SvgText>
          ) : null}
          {last > 0 ? (
            <SvgText
              x={layout.points[last].x}
              y={HEIGHT - 10}
              fontSize={11}
              fill="#555"
              textAnchor="end"
            >
              {points[last].label}
            </SvgText>
          ) : null}
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { height: HEIGHT, alignSelf: 'stretch' },
});
