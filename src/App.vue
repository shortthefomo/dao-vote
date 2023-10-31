<template>
    <main class="container">
        <Landing v-if="components.Landing" :client="client" :Sdk="Sdk" :nodetype="nodetype">{DAO VOTE}</Landing>
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
    import { XummSdkJwt } from 'xumm-sdk'
    const xapp = window.xAppSdk
    
    export default {
        components: {
            Landing,
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
                },
                client: null,
                signedIn: false
            }
        },
        async mounted() {
            console.log('in we go.')
            await this.jwtFlow()

            // if (this.components.Landing) { return }
            
            // this.components.Landing = true
            // if (this.$store.getters.getAccount == 'rNbDBfxEpSV2G9Y8Qbvsn4mEZ98DafkpxK') {
            //     this.components.Landing = false
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
                
                this.$store.dispatch('setClientServers', this.servers)
                this.$store.dispatch('clientConnect', false)
                this.client = this.$store.getters.getClient
                await this.jwtSignIn()
                this.currentLedger()
            },
            async test(uuid) {
                const {data} = await this.axios.get(`https://vote-backend.panicbot.xyz/api/v1/payload_uuid?appkey=${import.meta.env.VITE_XUMM_APPKEY}&uuid=${uuid}`)
                console.log('test', data)
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
                        console.log('event', event)
                        console.log('UUID', event.data.payload_uuidv4)
                        await self.test(event.data.payload_uuidv4)
                        self.components.Landing = true
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
            // test(key) {
            //     return Buffer.from(codec.decodeNodePublic(key)).toString('hex').toUpperCase()
            // },
        }
    }
</script>