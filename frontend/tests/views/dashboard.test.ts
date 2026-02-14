import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import { mount, shallowMount, VueWrapper } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import Dashboard from '@/views/Dashboard/index.vue';

describe('Dashboard View Tests', () => {
  let wrapper: VueWrapper;

  const mockStats = {
    totalGroups: 5,
    totalMembers: 10000,
    activeMembers: 7500,
    messagesToday: 2500,
    newMembersToday: 150,
    revenue: 5000
  };

  const mockChartsData = {
    memberGrowth: [
      { date: '2024-01-01', count: 100 },
      { date: '2024-01-02', count: 150 },
      { date: '2024-01-03', count: 200 }
    ],
    messageActivity: [
      { hour: '00:00', count: 100 },
      { hour: '06:00', count: 50 },
      { hour: '12:00', count: 200 }
    ],
    groupDistribution: [
      { name: 'Group A', value: 40 },
      { name: 'Group B', value: 35 },
      { name: 'Group C', value: 25 }
    ]
  };

  beforeAll(() => {
    vi.mock('@/api', () => ({
      getStats: vi.fn().mockResolvedValue({
        stats: mockStats,
        charts: mockChartsData
      }),
      getGroups: vi.fn().mockResolvedValue([]),
      getRecentActivities: vi.fn().mockResolvedValue([])
    }));
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    wrapper = mount(Dashboard, {
      global: {
        plugins: [createTestingPinia({
          createSpy: vi.fn
        })],
        stubs: {
          'el-card': {
            template: '<div class="el-card"><slot></slot></div>',
            props: ['body-style']
          },
          'el-row': {
            template: '<div class="el-row"><slot></slot></div>'
          },
          'el-col': {
            template: '<div class="el-col"><slot></slot></div>',
            props: ['span', 'xs', 'sm', 'md', 'lg', 'xl']
          },
          'el-statistic': {
            template: '<div class="el-statistic"><slot name="prefix"></slot><slot></slot><slot name="suffix"></slot></div>',
            props: ['value', 'title', 'prefix', 'suffix']
          },
          'el-progress': {
            template: '<div class="el-progress"><slot></slot></div>',
            props: ['percentage', 'stroke-width', 'color']
          },
          'el-table': {
            template: '<table class="el-table"><thead><slot name="header"></slot></thead><tbody><slot></tbody></table>',
            props: ['data', 'stripe', 'border']
          },
          'el-table-column': {
            template: '<td class="el-table-column"><slot></slot></td>',
            props: ['prop', 'label', 'width', 'align']
          },
          'el-tag': {
            template: '<span class="el-tag"><slot></slot></span>',
            props: ['type', 'effect']
          },
          'el-button': {
            template: '<button><slot></slot></button>',
            props: ['type', 'size', 'link']
          },
          'el-date-picker': {
            template: '<input type="date" />',
            props: ['modelValue', 'type', 'start-placeholder', 'end-placeholder']
          },
          'el-select': {
            template: '<select><slot></slot></select>',
            props: ['modelValue', 'placeholder']
          },
          'el-option': {
            template: '<option><slot></slot></option>',
            props: ['value', 'label']
          },
          'el-empty': {
            template: '<div class="el-empty"><slot></slot></div>'
          },
          'el-skeleton': {
            template: '<div class="el-skeleton"><slot></slot></div>'
          },
          'el-skeleton-item': {
            template: '<div class="el-skeleton-item"></div>',
            props: ['variant']
          },
          'el-icon': {
            template: '<i><slot></slot></i>'
          }
        }
      }
    });
  });

  afterEach(() => {
    wrapper = null;
  });

  describe('Component Rendering', () => {
    it('should render dashboard layout', () => {
      expect(wrapper.find('.dashboard-container').exists()).toBe(true);
    });

    it('should render page header', () => {
      const header = wrapper.find('.dashboard-header');
      expect(header.exists()).toBe(true);
      expect(header.text()).toContain('数据看板');
    });

    it('should render statistics cards', () => {
      const statsCards = wrapper.findAll('.stat-card');
      expect(statsCards.length).toBeGreaterThanOrEqual(4);
    });

    it('should render charts section', () => {
      const chartsSection = wrapper.find('.charts-section');
      expect(chartsSection.exists()).toBe(true);
    });

    it('should render recent activity table', () => {
      const activityTable = wrapper.find('.activity-section');
      expect(activityTable.exists()).toBe(true);
    });

    it('should render date range picker', () => {
      const datePicker = wrapper.find('.date-range-picker');
      expect(datePicker.exists()).toBe(true);
    });
  });

  describe('Statistics Cards', () => {
    it('should display total groups', () => {
      const totalGroupsCard = wrapper.find('.stat-card.total-groups');
      expect(totalGroupsCard.exists()).toBe(true);
    });

    it('should display total members', () => {
      const totalMembersCard = wrapper.find('.stat-card.total-members');
      expect(totalMembersCard.exists()).toBe(true);
    });

    it('should display active members', () => {
      const activeMembersCard = wrapper.find('.stat-card.active-members');
      expect(activeMembersCard.exists()).toBe(true);
    });

    it('should display messages today', () => {
      const messagesCard = wrapper.find('.stat-card.messages-today');
      expect(messagesCard.exists()).toBe(true);
    });

    it('should display new members today', () => {
      const newMembersCard = wrapper.find('.stat-card.new-members');
      expect(newMembersCard.exists()).toBe(true);
    });

    it('should display revenue', () => {
      const revenueCard = wrapper.find('.stat-card.revenue');
      expect(revenueCard.exists()).toBe(true);
    });
  });

  describe('Charts', () => {
    it('should render member growth chart', () => {
      const memberGrowthChart = wrapper.find('.chart.member-growth');
      expect(memberGrowthChart.exists()).toBe(true);
    });

    it('should render message activity chart', () => {
      const activityChart = wrapper.find('.chart.message-activity');
      expect(activityChart.exists()).toBe(true);
    });

    it('should render group distribution chart', () => {
      const distributionChart = wrapper.find('.chart.group-distribution');
      expect(distributionChart.exists()).toBe(true);
    });

    it('should update charts when data changes', async () => {
      await wrapper.setData({
        chartsData: {
          ...mockChartsData,
          memberGrowth: [
            { date: '2024-01-01', count: 200 },
            { date: '2024-01-02', count: 300 }
          ]
        }
      });

      expect(wrapper.vm.chartsData.memberGrowth.length).toBe(2);
    });
  });

  describe('Data Loading', () => {
    it('should show skeleton while loading', async () => {
      await wrapper.setData({ loading: true });
      
      const skeleton = wrapper.find('.loading-skeleton');
      expect(skeleton.exists()).toBe(true);
    });

    it('should hide skeleton after data loads', async () => {
      await wrapper.setData({ loading: false, stats: mockStats });
      
      const skeleton = wrapper.find('.loading-skeleton');
      expect(skeleton.exists()).toBe(false);
    });

    it('should fetch data on mount', async () => {
      const fetchDataSpy = vi.spyOn(wrapper.vm, 'fetchData');
      
      await wrapper.vm.$nextTick();
      
      expect(fetchDataSpy).toHaveBeenCalled();
    });
  });

  describe('Date Range Filtering', () => {
    it('should update date range when picker changes', async () => {
      const newRange = {
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      };
      
      await wrapper.setData({ dateRange: newRange });
      
      expect(wrapper.vm.dateRange).toEqual(newRange);
    });

    it('should refetch data when date range changes', async () => {
      const fetchDataSpy = vi.spyOn(wrapper.vm, 'fetchData');
      
      await wrapper.setData({ dateRange: { startDate: '2024-01-01', endDate: '2024-01-31' } });
      
      expect(fetchDataSpy).toHaveBeenCalled();
    });
  });

  describe('Group Filtering', () => {
    it('should have group filter dropdown', () => {
      const groupFilter = wrapper.find('.group-filter');
      expect(groupFilter.exists()).toBe(true);
    });

    it('should update selected group', async () => {
      await wrapper.setData({ selectedGroup: 'group_1' });
      
      expect(wrapper.vm.selectedGroup).toBe('group_1');
    });

    it('should refetch data when group filter changes', async () => {
      const fetchDataSpy = vi.spyOn(wrapper.vm, 'fetchData');
      
      await wrapper.setData({ selectedGroup: 'group_2' });
      
      expect(fetchDataSpy).toHaveBeenCalled();
    });
  });

  describe('Recent Activity', () => {
    it('should display recent activities', () => {
      const activityList = wrapper.find('.recent-activities');
      expect(activityList.exists()).toBe(true);
    });

    it('should show empty state when no activities', async () => {
      await wrapper.setData({ recentActivities: [] });
      
      const emptyState = wrapper.find('.no-activities');
      expect(emptyState.exists()).toBe(true);
    });

    it('should display activity items', async () => {
      const mockActivities = [
        { id: 1, type: 'join', user: 'user1', group: 'Group A', time: '10:00' },
        { id: 2, type: 'message', user: 'user2', group: 'Group B', time: '10:05' }
      ];
      
      await wrapper.setData({ recentActivities: mockActivities });
      
      const activities = wrapper.findAll('.activity-item');
      expect(activities.length).toBe(2);
    });
  });

  describe('Refresh Functionality', () => {
    it('should have refresh button', () => {
      const refreshButton = wrapper.find('.refresh-btn');
      expect(refreshButton.exists()).toBe(true);
    });

    it('should refresh data on button click', async () => {
      const fetchDataSpy = vi.spyOn(wrapper.vm, 'fetchData');
      
      const refreshButton = wrapper.find('.refresh-btn');
      await refreshButton.trigger('click');
      
      expect(fetchDataSpy).toHaveBeenCalled();
    });

    it('should show loading state during refresh', async () => {
      await wrapper.setData({ refreshing: true });
      
      const refreshButton = wrapper.find('.refresh-btn');
      expect(refreshButton.props('loading')).toBe(true);
    });
  });

  describe('Export Functionality', () => {
    it('should have export button', () => {
      const exportButton = wrapper.find('.export-btn');
      expect(exportButton.exists()).toBe(true);
    });

    it('should export data on button click', async () => {
      const exportDataSpy = vi.spyOn(wrapper.vm, 'exportData');
      
      const exportButton = wrapper.find('.export-btn');
      await exportButton.trigger('click');
      
      expect(exportDataSpy).toHaveBeenCalled();
    });
  });

  describe('Responsive Design', () => {
    it('should adapt to mobile viewport', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375
      });
      
      window.dispatchEvent(new Event('resize'));
      
      const container = wrapper.find('.dashboard-container');
      expect(container.classes()).toContain('mobile');
    });

    it('should adjust grid columns on mobile', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768
      });
      
      window.dispatchEvent(new Event('resize'));
      
      expect(wrapper.find('.stat-card').classes()).toContain('col-span-6');
    });
  });

  describe('Error Handling', () => {
    it('should display error message on data fetch failure', async () => {
      await wrapper.setData({ error: 'Failed to fetch data' });
      
      const errorMessage = wrapper.find('.error-message');
      expect(errorMessage.exists()).toBe(true);
      expect(errorMessage.text()).toContain('Failed to fetch data');
    });

    it('should retry on error', async () => {
      const retryButton = wrapper.find('.retry-btn');
      await retryButton.trigger('click');
      
      const fetchDataSpy = vi.spyOn(wrapper.vm, 'fetchData');
      expect(fetchDataSpy).toHaveBeenCalled();
    });
  });
});
