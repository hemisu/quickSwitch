// @flow
import React, { Component } from 'react';
import { 
  Layout,
  Button,
  Menu,
  Icon,
  Card,
  Row,
  Col,
  Switch,
  Input,
  Modal,
  Tooltip,
  Form,
  Upload,
} from 'antd';
import { ipcRenderer } from 'electron';
import ConsolePage from './ConsolePage';
// import Home from '../components/Home';
import WrappedConfigForm from '../components/ConfigForm';

const { Sider, Content } = Layout;
// const { SubMenu } = Menu;
const { Item: MenuItem } = Menu;
const { Meta } = Card;
const { TextArea } = Input;
const FormItem = Form.Item;
const confirm = Modal.confirm;
const path = require('path');

type Props = {};




export default class HomePage extends Component<Props> {
  props: Props;

  state = {
    collapsed: false,
    list: {},
    modelVisible: false,
    isCreate: false,
    currentEdit: {
      appName: '',
      config: {},
    },
  };

  constructor(props) {
    super(props);
    this.formRef = React.createRef();
  }

  componentDidMount() {
    this.getConfigList();
    ipcRenderer.on('init', () => {
      console.log('初始化成功'); 
    })
  }
  componentWillUnmount() {
    ipcRenderer.removeAllListeners();
  }

  onCollapse = (collapsed) => {
    this.setState({ collapsed });
  }

  getConfigList = () => {
    ipcRenderer.send('getConfig');
    ipcRenderer.on('GET_CONFIG_SUCCESS', (event, list) => {
      // console.log(list);
      this.setState({
        list,
      })
    });
  }

  showCreateModal = () => () => {
    this.setState({
      isCreate: true,
      modelVisible: true,
      currentEdit: {
        appName: '',
        config: {},
      },
    });
  }

  showEditModal = (appName = '', config = {}) => () => {
    console.log(appName, config);
    this.setState({
      isCreate: false,
      modelVisible: true,
      currentEdit: {
        appName,
        config,
      }
    });
  }

  handleCreateOk = (e) => {
    const modalForm = this.formRef.current.props.form;
    modalForm.validateFields((err, values) => {
      if (err) return;
      const { appName } = values;
      // 检测是否已经存在这个项目名
      if (Object.keys(this.state.list).includes(appName)) {
        modalForm.setFields({
          appName: {
            value: '',
            errors: [new Error('已存在的标识名')],
          },
        });
        return;
      }
      const newList = {...this.state.list};
  
      // 新导入nginx文件
      ipcRenderer.send('importNginx', null, values.nginxFileName);
      values.nginxFileName = path.parse(values.nginxFileName).name;
      newList[appName] = values;
      // 存储配置
      ipcRenderer.send('setConfig', newList);
      this.setState({
        modelVisible: false,
        list: newList,
      });
    });
  }

  handleEditOk = (e) => {
    // console.log(e);
    // const values = this.formRef.current.getValues() || {};
    this.formRef.current.props.form.validateFields((err, values) => {
      // console.log('configForm', values);
      if (err) return;
      const {
        currentEdit: {
          appName,
          config,
        },
      } = this.state;
      // console.log(appName, config)
      const newList = {...this.state.list};
      // 文件变动？ 读取文件->对比->如果不同则替换
      ipcRenderer.send('importNginx', config.nginxFileName, values.nginxFileName);
      // 存储配置
      values.nginxFileName = path.parse(values.nginxFileName).name;
      newList[appName] = {...config, ...values};
      ipcRenderer.send('setConfig', newList);
      this.setState({
        modelVisible: false,
        list: newList,
      });
    });
  }

  handleDelete = (appName) => () => {
    // console.log(appName);
    const that = this;
    confirm({
      title: `你确定要删掉${appName}这个应用吗?`,
      content: `介绍还在想 如果你不喜欢我建议你充钱`,
      okText: '确定',
      okType: 'danger',
      cancelText: '取消',
      onOk() {
        const newList = that.state.list;
        delete newList[appName];
        // 存储配置
        ipcRenderer.send('setConfig', newList);
        that.setState({
          list: newList,
        });
      },
      onCancel() {
        console.log('Cancel');
      },
    });
  }

  handleClick = () => {
    ipcRenderer.send('getConfig');
  }

  handleImportConfig = () => {
    ipcRenderer.send('importConfig');
    this.getConfigList()
  }

  handleOpenSwitch = (appName) => (checked) => {
    const newList = {...this.state.list};

    if(checked) {
      // 存储host文件 应当在存储host之后再生效配置
      ipcRenderer.send('setHosts', [
        { 
          name: newList[appName].applicationName,
          url: newList[appName].ip,
          hostname: newList[appName].hostname,
          checked,
        },
      ]);
    } else {
      // 关闭配置
      ipcRenderer.send('inactiveConfig');
    }
    
    ipcRenderer.once('SET_HOSTS_SUCCESS', () => {
      // 配置生效
      ipcRenderer.send('activeConfig', newList[appName], appName);
      ipcRenderer.once('ACTIVE_CONFIG_SUCCESS', () => {
        Object.keys(this.state.list).forEach((k) => {
          newList[k].checked = false;
        });
        newList[appName].checked = true;
        // 存储配置
        ipcRenderer.send('setConfig', newList);
        this.setState({
          list: newList,
        })
      })
    });
    ipcRenderer.once('RESET_CONFIG_SUCCESS', () => {
      newList[appName].checked = false;
      // 存储配置
      ipcRenderer.send('setConfig', newList);
      this.setState({
        list: newList,
      })
    });
  }

  handleTraySwitch = (appName) => (checked) => {
    const newList = {...this.state.list};
    newList[appName].showOnTray = checked;
    // 存储配置
    ipcRenderer.send('setConfig', newList);
    this.setState({
      list: newList,
    })
  }

  handleLog = () => {
    // ipcRenderer.send('log', '123test');
    // ipcRenderer.send('getItem', 'config');
    // ipcRenderer.on('GET_ITEM_CONFIG_SUCCESS', (event, list) => {
    //   console.log(list);
    // });
  }

  handleQuit = () => {
    // console.log('enter')
    ipcRenderer.send('quitApp');
  }

  render() {
    const { currentEdit } = this.state;
    return (
      <div className="App" style={{ height: '100%' }}>
        <Layout>
          <Sider
            collapsible
            collapsed={this.state.collapsed}
            onCollapse={this.onCollapse}
          >
            <div className="logo">
              {this.state.collapsed ? 'QS' : 'QuickSwitch'}
            </div>
            <Menu theme="dark" defaultSelectedKeys={['1']} mode="inline">
              <MenuItem key="1">
                <Icon type="setting" />
                <span>设置</span>
              </MenuItem>
              <MenuItem key="2" onClick={() => ipcRenderer.send('open', 'config')}>
                <Icon type="bars" />
                <span>配置文件</span>
              </MenuItem>
              <MenuItem key="3" onClick={() => ipcRenderer.send('open', 'hostDir')}>
                <Icon type="edit" />
                <span>hosts文件</span>
              </MenuItem>
              <MenuItem key="4" onClick={() => ipcRenderer.send('open', 'nginxDir')}>
                <Icon type="file" />
                <span>nginx文件夹</span>
              </MenuItem>
              <MenuItem key="5" onClick={this.handleQuit}>
                <Icon type="poweroff" />
                <span>退出</span>
              </MenuItem>
            </Menu>
          </Sider>
          <Content style={{padding: 16}}>
            {
              Object.keys(this.state.list).length === 0 && 
              <div style={{ textAlign: 'center' }}>
                暂无数据，请 <Button onClick={this.showCreateModal()}>添加项目</Button> 或 <Button onClick={this.handleImportConfig}>导入配置文件</Button>
              </div>
            }
            <Row gutter={16} type="flex" style={{ flexWrap: 'wrap' }}>
              {
                Object.entries(this.state.list).map(([k, v]) => (
                  <Col span={12} key={k} style={{ marginTop: 16 }}>
                    <Card
                      actions={[
                        <Icon type="edit" onClick={this.showEditModal(k, v)} />,
                        <Icon type="delete" onClick={this.handleDelete(k)}/>,
                      ]}
                    >
                      <Meta
                        title={k}
                        description={v.applicationName}
                      />
                      <div className="operations">
                        <div>
                          是否启用
                          <Switch
                            onChange={this.handleOpenSwitch(k)}
                            checked={v.checked}
                            disabled={v.disabled}
                          />
                          {
                            v.disabled &&
                            <Tooltip title="nginx文件不存在">
                              <span style={{ color: 'red' }}><Icon type="exclamation-circle" /></span>
                            </Tooltip>
                          }
                        </div>
                        <div>
                          MenuBar显示
                          <Switch
                            onChange={this.handleTraySwitch(k)}
                            checked={v.showOnTray}
                          />
                        </div>
                      </div>
                      <ul>
                        <li>项目网址：{v.hostname}</li>
                        <li>api地址：{v.api}</li>
                      </ul>
                    </Card>
                  </Col>
                ))
              }
            </Row>
            {/* <ConsolePage /> */}
            <Row style={{ marginTop: 16 }} justify="center" type="flex">
              {Object.keys(this.state.list).length !== 0 && <Button style={{ marginRight: 8 }} onClick={this.showCreateModal()}>添加项目</Button>}
              <Button type="primary" onClick={this.handleClick}>重载配置</Button>
              {/* <Button type="primary" onClick={this.handleLog}>Log</Button> */}
            </Row>
            <Modal
              title={this.state.isCreate ? "新建" :"编辑"}
              style={{ top: 20 }}
              onOk={this.state.isCreate ? this.handleCreateOk : this.handleEditOk}
              onCancel={() => this.setState({ modelVisible: false, currentEdit: { appName: '', config: {}}})}
              visible={this.state.modelVisible}
              destroyOnClose
            >
              <WrappedConfigForm wrappedComponentRef={this.formRef} record={this.state.currentEdit} isCreate={this.state.isCreate} />
            </Modal>
          </Content>
        </Layout>
      </div>
    );
  }
}