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
const FormItem = Form.Item;

class ConfigForm extends Component {
  state = {
    fileList: [],
    hasFileSelect: false,
  }

  componentDidMount() {
    this.setValues(this.props.record.config);
  }

  setValues = (values) => {
    this.props.form.setFieldsValue(values);
  }

  render() {
    const formItemLayout = {
      labelCol: { span: 6 },
      wrapperCol: { span: 14 },
    };
    const buttonItemLayout = {
      wrapperCol: { span: 14, offset: 4 },
    };
    const { getFieldDecorator } = this.props.form;
    return (
      <Form layout="horizontal">
        {
          this.props.isCreate && 
          <FormItem
            label="标识名"
            {...formItemLayout}
          >
          {
            getFieldDecorator('appName', {
              rules: [{
                required: true,
                message: '请输入应用名称',
              }],
            })(
              <Input placeholder="标识名(英文或数字) 如: recruit"/>
            )
          }
          </FormItem>
        }
        <FormItem
          label="应用中文名"
          {...formItemLayout}
        >
        {
          getFieldDecorator('applicationName', {
            rules: [{
              required: true,
              message: '请输入应用名称',
            }],
          })(
            <Input placeholder="应用名称  如：招聘系统"/>
          )
        }
        </FormItem>
        <FormItem
          label="域名"
          {...formItemLayout}
        >
        {
          getFieldDecorator('hostname', {
            rules: [{
              required: true,
              message: '请输入网址',
            }],
          })(
            <Input addonBefore="http://"  />
          )
        }
        </FormItem>
        <FormItem
          label="ip"
          {...formItemLayout}
        >
        {
          getFieldDecorator('ip', {
            initialValue: "127.0.0.1",
            rules: [{
              required: true,
              message: '请输入ip',
            }],
          })(
            <Input />
          )
        }
        </FormItem>
        <FormItem
          label="nginx文件"
          required={true}
          {...formItemLayout}
        >
        {
          getFieldDecorator('nginxFileName', {
            rules: [{
              required: true,
              message: '请选择nginx文件',
            }],
            normalize: (value) => {
              if (this.state.fileList.length === 0) {
                return value;
              } else {
                return this.state.fileList[0].path;
              }
            }
          })(
            <Input type="hidden" />)
        }
          <Upload 
            {
              ...{
                action: 'temp/',
                onRemove: (file) => {
                  this.setState(({ fileList }) => {
                    const index = fileList.indexOf(file);
                    const newFileList = fileList.slice();
                    newFileList.splice(index, 1);
                    return {
                      fileList: newFileList,
                      hasFileSelect: false,
                    };
                  });
                },
                beforeUpload: (file) => {
                  this.setState(({ fileList }) => ({
                    fileList: [...fileList, file],
                    hasFileSelect: true,
                  }));
                  return false;
                },
                fileList: this.state.fileList,
              }
            }
          >
            { this.state.hasFileSelect ? '' : <Button icon="plus">选择nginx文件</Button>}
          </Upload>
        </FormItem>
        <FormItem
          label="MenuBar显示"
          {...formItemLayout}
        >
        {
          getFieldDecorator('showOnTray', {
            valuePropName: 'checked',
            initialValue: false,
          })(
            <Switch />
          )
        }
        </FormItem>
      </Form>
    );
  }
}

export default Form.create()(ConfigForm);