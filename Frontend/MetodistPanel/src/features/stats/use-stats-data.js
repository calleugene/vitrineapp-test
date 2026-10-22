import {useEffect, useState} from 'react';
import {analyticsApi} from '../../api';
import {mapStatsBarsData, mapStatsBreakdownData, mapStatsChartData, mapStatsRankedData, mapStatsSummaryCards} from './mappers';

export function useStatsData({isAuthenticated, statsTab, statsPeriod}) {
  const [statsDataByTab, setStatsDataByTab] = useState({});
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    async function load() {
      const results = await Promise.allSettled([
        analyticsApi.statsSummary(statsTab, statsPeriod),
        analyticsApi.statsChart(statsTab, statsPeriod),
        analyticsApi.statsBreakdown(statsTab, statsPeriod),
        analyticsApi.statsRanked(statsTab, statsPeriod),
        analyticsApi.statsBars(statsTab, statsPeriod),
      ]);
      if (cancelled) return;
      const payload = (index) => results[index].status === 'fulfilled' ? results[index].value : null;
      setStatsDataByTab((previous) => ({...previous, [statsTab]: {
        period: statsPeriod,
        summary: mapStatsSummaryCards(payload(0)),
        chart: mapStatsChartData(payload(1)),
        breakdown: mapStatsBreakdownData(payload(2)),
        ranked: mapStatsRankedData(payload(3)),
        bars: mapStatsBarsData(payload(4)),
        errors: results.flatMap((result, index) => result.status === 'rejected' ? [['Метрики', 'График', 'Типы событий', 'Рейтинг экспонатов', 'Доли просмотров'][index]] : []),
        meta: payload(1)?.meta || payload(0)?.meta,
        retry: () => { void load(); },
      }}));
    }
    void load();
    return () => { cancelled = true; };
  }, [isAuthenticated, statsPeriod, statsTab]);
  return {statsDataByTab};
}
