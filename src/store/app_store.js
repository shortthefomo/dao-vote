'use strict'
 /* eslint-disable */ 

import { XrplClient } from 'xrpl-client'

export const AppStore = {
    state: () => ({
        version: '0.0.1',
        xumm: {
            tokenData: null
        },
        client: null,
        servers: [],
        account: '',
        user_token: '',
        ledger: 0,
        data: {}
    }),
    actions: {
        xummTokenData({commit}, data) {
            commit('TOKEN_DATA', data)
        },
        setUserToken({commit}, user_token) {
            commit('USER_TOKEN', user_token)
        },
        setAccount({commit}, account) {
            commit('ACCOUNT', account)
        },
        setLedger({commit}, ledger) {
            commit('LEDGER', ledger)
        },
        setStorage({commit}, data) {
            commit('STORE', data)
        },
        clientConnect({commit}, force) {
            commit('CONNECT', force)
        },
        setClientServers({commit}, servers) {
            commit('SERVERS', servers)
        },
    },
    mutations: {
        TOKEN_DATA(state, data) {
            state.xumm.tokenData = data
        },
        ACCOUNT(state, account) {
            state.account = account
        },
        USER_TOKEN(state, user_token) {
            state.user_token = user_token
        },
        LEDGER(state, ledger) {
            state.ledger = ledger
        },
        STORE(state, data) {
            state.data = data
        },
        CONNECT(state, force) {
            if (state.servers.length < 0) { return }
            if (force || state.client == null) {
                state.client = new XrplClient(state.servers)
            }
        },
        SERVERS(state, servers) {
            let diff = false
            if (state.servers != servers) {
                diff = true
            }
            state.servers = servers

            if (diff && state.client != null) {
                state.client = new XrplClient(state.servers)
            }
        },
    },
    getters: {
        getVersion: state => {
            return state.version
        },
        getXummTokenData: state => {
            return state.xumm.tokenData
        },
        getUserToken: state => {
            return state.user_token
        },
        getAccount: state => {
            return state.account
        },
        getLedger: state => {
            return state.ledger
        },
        getStoreage: state => {
            return state.data
        },
        getClient: state => {
            return state.client
        },
    }
}