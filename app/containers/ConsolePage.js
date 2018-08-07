import React, { Component } from 'react';
import {
  Button,
} from 'antd';
import { ipcRenderer } from 'electron';

export default class ConsolePage extends Component {
  handleSendMessage = () => {
    ipcRenderer.send('setItem', this.saveName.value, this.saveBody.value);
    console.log(this.saveName.value, this.saveBody.value);
    ipcRenderer.once(`SET_ITEM_${String.prototype.toUpperCase.call(this.saveName.value)}_SUCCESS`, (event, arg) => {
      console.log('send reply:', arg);
    });
  }

  handleGetMessage = () => {
    ipcRenderer.send('getItem', this.saveName.value);
    console.log(this.saveName.value);
    ipcRenderer.once(`GET_ITEM_${String.prototype.toUpperCase.call(this.saveName.value)}_SUCCESS`, (event, arg) => {
      console.log('1get reply:', arg);
    })
  }
  render() {
    return (
      <React.Fragment>
        <a href="#" id="drag">item</a>
        name<input ref={(r) => { this.saveName = r; }} />
        body<textarea ref={(r) => { this.saveBody = r; }} />
        <Button onClick={this.handleSendMessage}>发送信息</Button>
        <Button onClick={this.handleGetMessage}>获取信息</Button>
      </React.Fragment>
    )
  }
}