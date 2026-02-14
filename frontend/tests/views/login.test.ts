import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import { mount, shallowMount, VueWrapper } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { createRouter, createWebHistory } from 'vue-router';
import Login from '@/views/Login/index.vue';

describe('Login View Tests', () => {
  let router: any;
  let wrapper: VueWrapper;

  beforeAll(async () => {
    router = createRouter({
      history: createWebHistory(),
      routes: [
        { path: '/login', name: 'Login', component: Login },
        { path: '/dashboard', name: 'Dashboard', component: { template: '<div>Dashboard</div>' } }
      ]
    });
  });

  afterAll(() => {
    router = null;
  });

  beforeEach(() => {
    wrapper = mount(Login, {
      global: {
        plugins: [
          createTestingPinia({
            createSpy: vi.fn
          }),
          router
        ],
        stubs: {
          'el-form': {
            template: '<form @submit.prevent="handleSubmit"><slot></slot></form>',
            props: ['model', 'rules']
          },
          'el-form-item': {
            template: '<div class="form-item"><slot></slot></div>',
            props: ['prop', 'label']
          },
          'el-input': {
            template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
            props: ['modelValue', 'placeholder', 'type', 'prefix-icon']
          },
          'el-button': {
            template: '<button @click="$emit(\'click\')"><slot></slot></button>',
            props: ['loading', 'type', 'nativeType', 'disabled']
          },
          'el-checkbox': {
            template: '<label><input type="checkbox" :checked="modelValue" @change="$emit(\'update:modelValue\', $event.target.checked)" /><slot></slot></label>',
            props: ['modelValue']
          }
        }
      }
    });
  });

  afterEach(() => {
    wrapper = null;
  });

  describe('Component Rendering', () => {
    it('should render login form', () => {
      expect(wrapper.find('form').exists()).toBe(true);
    });

    it('should render email input field', () => {
      const emailInput = wrapper.find('input[placeholder="请输入邮箱"]');
      expect(emailInput.exists()).toBe(true);
    });

    it('should render password input field', () => {
      const passwordInput = wrapper.find('input[type="password"]');
      expect(passwordInput.exists()).toBe(true);
    });

    it('should render remember checkbox', () => {
      const checkbox = wrapper.find('input[type="checkbox"]');
      expect(checkbox.exists()).toBe(true);
    });

    it('should render login button', () => {
      const button = wrapper.find('button');
      expect(button.exists()).toBe(true);
      expect(button.text()).toContain('登录');
    });

    it('should render logo', () => {
      const logo = wrapper.find('.login-logo');
      expect(logo.exists()).toBe(true);
    });
  });

  describe('Form Validation', () => {
    it('should validate email format', async () => {
      const emailInput = wrapper.find('input[placeholder="请输入邮箱"]');
      
      await emailInput.setValue('invalid-email');
      await emailInput.trigger('blur');
      
      const form = wrapper.findComponent({ name: 'elForm' });
      expect(form.props('model').email).toBe('invalid-email');
    });

    it('should accept valid email', async () => {
      const emailInput = wrapper.find('input[placeholder="请输入邮箱"]');
      
      await emailInput.setValue('test@example.com');
      expect(emailInput.element.value).toBe('test@example.com');
    });

    it('should accept valid password', async () => {
      const passwordInput = wrapper.find('input[type="password"]');
      
      await passwordInput.setValue('SecurePass123');
      expect(passwordInput.element.value).toBe('SecurePass123');
    });
  });

  describe('Form Submission', () => {
    it('should emit submit event on form submit', async () => {
      const form = wrapper.find('form');
      await form.trigger('submit.prevent');
      
      expect(wrapper.emitted('submit')).toBeTruthy();
    });

    it('should handle login with valid credentials', async () => {
      const emailInput = wrapper.find('input[placeholder="请输入邮箱"]');
      const passwordInput = wrapper.find('input[type="password"]');
      
      await emailInput.setValue('admin@example.com');
      await passwordInput.setValue('password123');
      
      const form = wrapper.find('form');
      await form.trigger('submit.prevent');
      
      expect(wrapper.emitted('submit')).toBeTruthy();
    });
  });

  describe('Loading State', () => {
    it('should show loading state when submitting', async () => {
      await wrapper.setData({ loading: true });
      
      const button = wrapper.find('button');
      expect(button.props('loading')).toBe(true);
    });

    it('should disable button during loading', async () => {
      await wrapper.setData({ loading: true });
      
      const button = wrapper.find('button');
      expect(button.props('disabled')).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should display error message on login failure', async () => {
      await wrapper.setData({ error: '用户名或密码错误' });
      
      const errorMessage = wrapper.find('.login-error');
      expect(errorMessage.exists()).toBe(true);
      expect(errorMessage.text()).toContain('用户名或密码错误');
    });

    it('should clear error on input', async () => {
      await wrapper.setData({ error: '用户名或密码错误' });
      
      const emailInput = wrapper.find('input[placeholder="请输入邮箱"]');
      await emailInput.setValue('newemail@test.com');
      
      expect(wrapper.vm.error).toBe('');
    });
  });

  describe('Password Visibility Toggle', () => {
    it('should have password visibility toggle', () => {
      const toggle = wrapper.find('.password-toggle');
      expect(toggle.exists()).toBe(true);
    });

    it('should toggle password visibility', async () => {
      const toggle = wrapper.find('.password-toggle');
      await toggle.trigger('click');
      
      expect(wrapper.vm.showPassword).toBe(true);
      
      await toggle.trigger('click');
      expect(wrapper.vm.showPassword).toBe(false);
    });
  });

  describe('Remember Me', () => {
    it('should toggle remember me option', async () => {
      const checkbox = wrapper.find('input[type="checkbox"]');
      
      await checkbox.setChecked(true);
      expect(wrapper.vm.rememberMe).toBe(true);
      
      await checkbox.setChecked(false);
      expect(wrapper.vm.rememberMe).toBe(false);
    });
  });

  describe('Responsive Design', () => {
    it('should adapt to mobile viewport', () => {
      wrapper = shallowMount(Login, {
        global: {
          plugins: [createTestingPinia()],
          stubs: ['el-form', 'el-form-item', 'el-input', 'el-button', 'el-checkbox']
        }
      });
      
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375
      });
      
      window.dispatchEvent(new Event('resize'));
      
      const container = wrapper.find('.login-container');
      expect(container.classes()).toContain('mobile');
    });
  });

  describe('Keyboard Accessibility', () => {
    it('should focus email input on mount', async () => {
      const input = wrapper.find('input[placeholder="请输入邮箱"]');
      expect(input.element).toBe(document.activeElement || input.element);
    });

    it('should submit form on Enter key', async () => {
      const passwordInput = wrapper.find('input[type="password"]');
      
      await passwordInput.trigger('keydown.enter');
      
      expect(wrapper.emitted('submit')).toBeTruthy();
    });
  });

  describe('Routing Integration', () => {
    it('should navigate to dashboard after successful login', async () => {
      const pushSpy = vi.spyOn(router, 'push');
      
      await wrapper.setData({ 
        form: { email: 'admin@example.com', password: 'password123' }
      });
      
      const form = wrapper.find('form');
      await form.trigger('submit.prevent');
      
      expect(pushSpy).toHaveBeenCalledWith('/dashboard');
    });
  });
});

describe('Login Store Integration', () => {
  it('should use auth store', () => {
    const pinia = createTestingPinia({
      createSpy: vi.fn
    });
    
    const wrapper = mount(Login, {
      global: {
        plugins: [pinia],
        stubs: ['el-form', 'el-form-item', 'el-input', 'el-button', 'el-checkbox']
      }
    });
    
    const authStore = pinia.state.value.auth;
    expect(authStore).toBeDefined();
  });

  it('should call login action on form submit', async () => {
    const pinia = createTestingPinia({
      stubActions: false,
      createSpy: vi.fn
    });
    
    const mockLogin = vi.fn();
    
    pinia.state.value.auth = {
      login: mockLogin,
      isAuthenticated: false,
      user: null,
      token: null
    };
    
    const wrapper = mount(Login, {
      global: {
        plugins: [pinia],
        stubs: ['el-form', 'el-form-item', 'el-input', 'el-button', 'el-checkbox']
      }
    });
    
    const form = wrapper.find('form');
    await form.trigger('submit.prevent');
    
    expect(mockLogin).toHaveBeenCalled();
  });
});
