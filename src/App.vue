<template>
    <header class="container">
        <Landing v-if="components.Landing" :client="client" :Sdk="Sdk" :nodetype="nodetype">{NFT Flush}</Landing>
    </header>

    <main>
        <Viewer v-if="components.Viewer" :client="client" :Sdk="Sdk" :nodetype="nodetype">{NFT Flush}</Viewer>
    </main>

    <!-- <footer class="container footer mb-2 mt-auto">
        <div class="border-top py-3">
            &copy; Three
            <Refs />
        </div>
    </footer> -->
</template>

<script>
    import Refs from './components/Refs.vue'
    import Landing from './components/Landing.vue'
    import Viewer from './components/Viewer.vue'

    import { XrplClient } from 'xrpl-client'

    const xapp = window.xAppSdk

    import {XummSdkJwt} from 'xumm-sdk'

    export default {
        components: {
            Landing,
            Viewer,
            Refs
        },
        data() {
            return {
                Sdk: new XummSdkJwt(import.meta.env.VITE_XUMM_APPKEY),
                nodetype: 'TESTNET',
                servers: [],
                pong: false,
                ready: false,
                components: {
                    Landing: false,
                    Viewer: false
                },
                client: null,
                signedIn: false
            }
        },
        async mounted() {
            console.log('hi...')
            await this.accountInfo()
            console.log('in we go.')

            // if (this.components.Landing) { return }
            
            this.components.Landing = true
            // if (this.$store.getters.getAccount == 'rNbDBfxEpSV2G9Y8Qbvsn4mEZ98DafkpxK') {
            //     this.components.Landing = false
            //     this.components.Viewer = true
            // }
            
        },
        methods: {
            currentLedger() {
                const callback = async (event) => {
                    let request = {
                        'id': 'xrpl-local',
                        'command': 'ledger',
                        'ledger_hash': event.ledger_hash,
                        'ledger_index': 'validated',
                        'transactions': true,
                        'expand': true,
                        'owner_funds': true
                    }
    
                    const ledger_result = await this.client.send(request)
                    if ('error' in ledger_result) {
                        console.log('XRPL error', ledger_result)
                    }
                    
                    if ('ledger' in ledger_result) {
                        // console.log('ledger', ledger_result)
                        this.$store.dispatch('setLedger', ledger_result.ledger.ledger_index)
                    }
                }
                this.client.on('ledger', callback)
            },
            async jwtFlow() {
                const tokenData = await this.Sdk.getOttData()
                console.log('tokenData', tokenData)
                this.$store.dispatch('xummTokenData', tokenData)
                console.log('account', tokenData.account)
                this.$store.dispatch('setAccount', tokenData.account)
                this.nodetype = tokenData.nodetype

                this.servers = [tokenData.nodewss]
                if (tokenData.nodetype === 'MAINNET') {
                    this.servers.unshift('wss://node.panicbot.xyz')
                }
                if (tokenData.nodetype === 'TESTNET') {
                    this.servers.unshift('wss://s.altnet.rippletest.net:51233/')
                }
                console.log('wss servers', this.servers)
                
                this.client = new XrplClient(this.servers)
                // await this.jwtSignIn()
                this.currentLedger()
                
            },
            async jwtSignIn() {
                const self = this
                const request  = { txjson: { TransactionType: 'SignIn' }}
                // const subscription = await this.Sdk.payload.create(request)

                const subscription = await this.Sdk.payload.createAndSubscribe(request, async event => {
                    console.log('New payload event:', event.data)

                    if (event.data.signed === true) {
                        console.log('Woohoo! The sign request was signed :)')
                        self.signedIn = true
                        self.$store.dispatch('setUserToken', event.data.payload_uuidv4)
                        // await self.getStoreage()
                        return event.data
                    }

                    if (event.data.signed === false) {
                        console.log('The sign request was rejected :(')
                        xapp.close({ refreshEvents: true })
                            .then(d => {
                                // d (returned value) can be Error or return data:
                                console.log('close response:', d instanceof Error ? d.message : d)
                            })
                            .catch(e => console.log('Error:', e.message))
                        return false
                    }
                })
                console.log('subscription', subscription)

                xapp.openSignRequest({ uuid: subscription.created.uuid })
                    .then(async d => {
                        // d (returned value) can be Error or return data:
                        console.log('openSignRequest response:', d instanceof Error ? d.message : d)
                    })
                    .catch(e => console.log('Error:', e.message))
            },
            async accountInfo() {
                this.client = new XrplClient('wss://s.altnet.rippletest.net:51233/')
                console.log('fetching accountInfo: ' + this.$store.getters.getAccount)
                console.log('this.client', this.client)
                const ledger_result = await this.client.send({ id:1, command: 'server_info'})
                console.log(ledger_result)

                const payload = {
                    'id': 3,
                    'command': 'account_info',
                    'account': this.$store.getters.getAccount,
                    'ledger_index': 'current'
                }
                console.log(payload)
                let res = await this.client.send(payload)
                console.log('accountInfo')
                console.log(res)
                // this.$store.dispatch('setAccountData', res.account_data)

                // const account_data = this.$store.getters.getAccountData
                // console.log('getAccountData', account_data)
                // const flags = flagNames(account_data.LedgerEntryType, account_data.Flags)
                // console.log('flags', flags)

                // // check if master key enabled.
                // if (flags.includes('lsfDisableMaster')) {
                //     this.masterKey = false
                //     console.log('masterkey disabled')
                // }
                // else {
                //     this.masterKey = true
                //     console.log('masterkey enabled')
                // }

                // if ('RegularKey' in account_data) {
                //     this.regularKeyAddress = account_data.RegularKey
                //     this.regularKey = true
                // }
                // else {
                //     this.regularKeyAddress = null
                //     this.regularKey = false
                // }

                // const tokenData = this.$store.getters.getXummTokenData
                // this.accountAccess = tokenData.accountaccess
                // console.log('this.accountAccess', this.accountAccess)
            },
        }
    }
</script>