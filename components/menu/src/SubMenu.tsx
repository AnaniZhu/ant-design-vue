import PropTypes from '../../_util/vue-types';
import {
  computed,
  defineComponent,
  getCurrentInstance,
  ref,
  watch,
  PropType,
  onBeforeUnmount,
} from 'vue';
import useProvideKeyPath, { useInjectKeyPath } from './hooks/useKeyPath';
import { useInjectMenu, useProvideFirstLevel, MenuContextProvider } from './hooks/useMenuContext';
import { getPropsSlot, isValidElement } from 'ant-design-vue/es/_util/props-util';
import classNames from 'ant-design-vue/es/_util/classNames';
import useDirectionStyle from './hooks/useDirectionStyle';
import PopupTrigger from './PopupTrigger';
import SubMenuList from './SubMenuList';
import InlineSubMenuList from './InlineSubMenuList';

let indexGuid = 0;
export default defineComponent({
  name: 'ASubMenu',
  props: {
    icon: PropTypes.VNodeChild,
    title: PropTypes.VNodeChild,
    disabled: Boolean,
    level: Number,
    popupClassName: String,
    popupOffset: Array as PropType<number[]>,
    internalPopupClose: Boolean,
  },
  slots: ['icon', 'title'],
  emits: ['titleClick', 'titleMouseenter', 'titleMouseleave'],
  inheritAttrs: false,
  setup(props, { slots, attrs, emit }) {
    useProvideFirstLevel(false);

    const instance = getCurrentInstance();
    const key = instance.vnode.key;

    const eventKey = `sub_menu_${++indexGuid}_$$_${key}`;
    const { parentEventKeys, parentInfo } = useInjectKeyPath();
    const keysPath = computed(() => [...parentEventKeys.value, eventKey]);

    const childrenEventKeys = ref([]);
    const menuInfo = {
      eventKey,
      key,
      parentEventKeys,
      childrenEventKeys,
    };

    parentInfo.childrenEventKeys?.value.push(eventKey);
    onBeforeUnmount(() => {
      if (parentInfo.childrenEventKeys) {
        parentInfo.childrenEventKeys.value = parentInfo.childrenEventKeys?.value.filter(
          k => k != eventKey,
        );
      }
    });

    useProvideKeyPath(eventKey, menuInfo);

    const {
      prefixCls,
      activeKeys,
      disabled: contextDisabled,
      changeActiveKeys,
      mode,
      inlineCollapsed,
      antdMenuTheme,
      openKeys,
      overflowDisabled,
      onOpenChange,
      registerMenuInfo,
      unRegisterMenuInfo,
    } = useInjectMenu();

    registerMenuInfo(eventKey, menuInfo);

    onBeforeUnmount(() => {
      unRegisterMenuInfo(eventKey);
    });

    const subMenuPrefixCls = computed(() => `${prefixCls.value}-submenu`);
    const mergedDisabled = computed(() => contextDisabled.value || props.disabled);
    const elementRef = ref();
    const popupRef = ref();

    // // ================================ Icon ================================
    // const mergedItemIcon = itemIcon || contextItemIcon;
    // const mergedExpandIcon = expandIcon || contextExpandIcon;

    // ================================ Open ================================
    const originOpen = computed(() => openKeys.value.includes(key));
    const open = computed(() => !overflowDisabled.value && originOpen.value);

    // =============================== Select ===============================
    const childrenSelected = ref(true); // isSubPathKey(selectedKeys, eventKey);

    const isActive = ref(false);
    watch(
      activeKeys,
      () => {
        isActive.value = !!activeKeys.value.find(val => val === key);
      },
      { immediate: true },
    );

    // =============================== Events ===============================
    // >>>> Title click
    const onInternalTitleClick = (e: Event) => {
      // Skip if disabled
      if (mergedDisabled.value) {
        return;
      }
      emit('titleClick', e, key);

      // Trigger open by click when mode is `inline`
      if (mode.value === 'inline') {
        onOpenChange(eventKey, !originOpen.value);
      }
    };

    const onMouseEnter = (event: MouseEvent) => {
      if (!mergedDisabled.value) {
        changeActiveKeys(keysPath.value);
        emit('titleMouseenter', event);
      }
    };
    const onMouseLeave = (event: MouseEvent) => {
      if (!mergedDisabled.value) {
        changeActiveKeys([]);
        emit('titleMouseleave', event);
      }
    };

    // ========================== DirectionStyle ==========================
    const directionStyle = useDirectionStyle(computed(() => keysPath.value.length));

    // >>>>> Visible change
    const onPopupVisibleChange = (newVisible: boolean) => {
      if (mode.value !== 'inline') {
        onOpenChange(eventKey, newVisible);
      }
    };

    /**
     * Used for accessibility. Helper will focus element without key board.
     * We should manually trigger an active
     */
    const onInternalFocus = () => {
      changeActiveKeys(keysPath.value);
    };

    // =============================== Render ===============================
    const popupId = eventKey && `${eventKey}-popup`;

    const popupClassName = computed(() =>
      classNames(
        prefixCls.value,
        `${prefixCls.value}-${antdMenuTheme.value}`,
        props.popupClassName,
      ),
    );
    const renderTitle = (title: any, icon: any) => {
      if (!icon) {
        return inlineCollapsed.value && props.level === 1 && title && typeof title === 'string' ? (
          <div class={`${prefixCls.value}-inline-collapsed-noicon`}>{title.charAt(0)}</div>
        ) : (
          title
        );
      }
      // inline-collapsed.md demo 依赖 span 来隐藏文字,有 icon 属性，则内部包裹一个 span
      // ref: https://github.com/ant-design/ant-design/pull/23456
      const titleIsSpan = isValidElement(title) && title.type === 'span';
      return (
        <>
          {icon}
          {titleIsSpan ? title : <span class={`${prefixCls.value}-title-content`}>{title}</span>}
        </>
      );
    };

    // Cache mode if it change to `inline` which do not have popup motion
    const triggerModeRef = computed(() => {
      return mode.value !== 'inline' && keysPath.value.length > 1 ? 'vertical' : mode.value;
    });

    const renderMode = computed(() => (mode.value === 'horizontal' ? 'vertical' : mode.value));

    return () => {
      const icon = getPropsSlot(slots, props, 'icon');
      const title = renderTitle(getPropsSlot(slots, props, 'title'), icon);
      const subMenuPrefixClsValue = subMenuPrefixCls.value;
      let titleNode = (
        <div
          role="menuitem"
          style={directionStyle.value}
          class={`${subMenuPrefixClsValue}-title`}
          tabindex={mergedDisabled.value ? null : -1}
          ref={elementRef}
          title={typeof title === 'string' ? title : null}
          data-menu-id={key}
          aria-expanded={open.value}
          aria-haspopup
          aria-controls={popupId}
          aria-disabled={mergedDisabled.value}
          onClick={onInternalTitleClick}
          onFocus={onInternalFocus}
          onMouseenter={onMouseEnter}
          onMouseleave={onMouseLeave}
        >
          {title}

          {/* Only non-horizontal mode shows the icon */}
          {mode.value !== 'horizontal' && slots.expandIcon ? (
            slots.expandIcon({ ...props, isOpen: open.value })
          ) : (
            <i class={`${subMenuPrefixClsValue}-arrow`} />
          )}
        </div>
      );

      if (!overflowDisabled.value) {
        const triggerMode = triggerModeRef.value;

        // Still wrap with Trigger here since we need avoid react re-mount dom node
        // Which makes motion failed
        titleNode = (
          <PopupTrigger
            mode={triggerMode}
            prefixCls={subMenuPrefixClsValue}
            visible={!props.internalPopupClose && open.value && mode.value !== 'inline'}
            popupClassName={popupClassName.value}
            popupOffset={props.popupOffset}
            disabled={mergedDisabled.value}
            onVisibleChange={onPopupVisibleChange}
            v-slots={{
              popup: () => (
                <MenuContextProvider props={{ mode: triggerModeRef }}>
                  <SubMenuList id={popupId} ref={popupRef}>
                    {slots.default?.()}
                  </SubMenuList>
                </MenuContextProvider>
              ),
            }}
          >
            {titleNode}
          </PopupTrigger>
        );
      }
      return (
        <MenuContextProvider props={{ mode: renderMode }}>
          <li
            {...attrs}
            role="none"
            class={classNames(
              subMenuPrefixClsValue,
              `${subMenuPrefixClsValue}-${mode.value}`,
              attrs.class,
              {
                [`${subMenuPrefixClsValue}-open`]: open.value,
                [`${subMenuPrefixClsValue}-active`]: isActive.value,
                [`${subMenuPrefixClsValue}-selected`]: childrenSelected.value,
                [`${subMenuPrefixClsValue}-disabled`]: mergedDisabled.value,
              },
            )}
          >
            {titleNode}

            {/* Inline mode */}
            {!overflowDisabled.value && (
              <InlineSubMenuList id={popupId} open={open.value} keyPath={keysPath.value}>
                {slots.default?.()}
              </InlineSubMenuList>
            )}
          </li>
        </MenuContextProvider>
      );
    };
  },
});
