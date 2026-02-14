import { config } from '@vue/test-utils';
import { vi } from 'vitest';
import { createTestingPinia } from '@pinia/testing';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';

config.global.plugins = [
  createTestingPinia({
    createSpy: vi.fn
  }),
  ElementPlus
];

config.global.mocks = {
  $t: (msg: string) => msg,
  $message: {
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
  },
  $notify: {
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
  }
};

config.global.stubs = {
  'el-button': {
    template: '<button><slot></slot></button>'
  },
  'el-input': {
    template: '<input><slot></slot></input>'
  },
  'el-table': {
    template: '<table><slot></slot></table>'
  },
  'el-table-column': {
    template: '<div><slot></slot></div>'
  },
  'el-dialog': {
    template: '<div><slot name="footer"></slot><slot></slot></div>'
  },
  'el-form': {
    template: '<form><slot></slot></form>'
  },
  'el-form-item': {
    template: '<div><slot></slot></div>'
  },
  'el-select': {
    template: '<select><slot></slot></select>'
  },
  'el-option': {
    template: '<option><slot></slot></option>'
  },
  'el-card': {
    template: '<div><slot></slot></div>'
  },
  'el-row': {
    template: '<div><slot></slot></div>'
  },
  'el-col': {
    template: '<div><slot></slot></div>'
  },
  'el-menu': {
    template: '<nav><slot></slot></nav>'
  },
  'el-menu-item': {
    template: '<li><slot></slot></li>'
  },
  'el-sub-menu': {
    template: '<li><slot></slot></li>'
  },
  'el-breadcrumb': {
    template: '<nav><slot></slot></nav>'
  },
  'el-breadcrumb-item': {
    template: '<span><slot></slot></span>'
  },
  'el-tag': {
    template: '<span><slot></slot></span>'
  },
  'el-switch': {
    template: '<input type="checkbox"><slot></slot></input>'
  },
  'el-checkbox': {
    template: '<label><input type="checkbox"><slot></slot></label>'
  },
  'el-radio': {
    template: '<label><input type="radio"><slot></slot></label>'
  },
  'el-radio-group': {
    template: '<div><slot></slot></div>'
  },
  'el-tabs': {
    template: '<div><slot name="tabs"></slot><slot></slot></div>'
  },
  'el-tab-pane': {
    template: '<div><slot></slot></div>'
  },
  'el-date-picker': {
    template: '<input type="date"><slot></slot></input>'
  },
  'el-upload': {
    template: '<div><slot></slot></div>'
  },
  'el-progress': {
    template: '<div><slot></slot></div>'
  },
  'el-statistic': {
    template: '<div><slot></slot></div>'
  },
  'el-empty': {
    template: '<div><slot></slot></div>'
  },
  'el-skeleton': {
    template: '<div><slot></slot></div>'
  },
  'el-skeleton-item': {
    template: '<div></div>'
  },
  'el-tooltip': {
    template: '<span><slot></slot></span>'
  },
  'el-dropdown': {
    template: '<div><slot></slot></div>'
  },
  'el-dropdown-menu': {
    template: '<ul><slot></slot></ul>'
  },
  'el-dropdown-item': {
    template: '<li><slot></slot></li>'
  },
  'el-popconfirm': {
    template: '<div><slot></slot></div>'
  },
  'el-image': {
    template: '<img><slot></slot></img>'
  },
  'el-spinner': {
    template: '<div></div>'
  },
  'el-icon': {
    template: '<i><slot></slot></i>'
  }
};

vi.mock('vue-router', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    go: vi.fn()
  })),
  useRoute: vi.fn(() => ({
    path: '/dashboard',
    name: 'Dashboard',
    params: {},
    query: {}
  })),
  createRouter: vi.fn(),
  createWebHistory: vi.fn(),
  createWebHashHistory: vi.fn()
}));

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      patch: vi.fn()
    })),
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn()
  }
}));

ElementPlus.install = vi.fn();

console.log('Vue Test Setup Initialized');
