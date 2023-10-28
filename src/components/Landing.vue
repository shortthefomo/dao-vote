<template>
    <div class="p-5 mb-4 bg-light rounded-3">
        <div class="container-fluid py-5">
            <img class="bog-roll" src="/e.png">
            <div class="col-md-8 fs-4">                
                <p class="text-muted text-end fs-6"><span class="fancy-font">DAO VOTE</span> by three</p>
            </div>
            <div class="col-md-12 fs-6">
                <p class="text">
                    Validator: {{ validator_key }}
                </p>
                <p v-if="validator_data !== null" class="text text-break">
                    Version: {{ validator_data.server_version }}
                </p>
                <p v-if="validator_data !== null" class="text">
                    Full: {{ validator_data.full }}
                </p>
                <button v-if="validator_key !== ''" type="button" class="btn btn-secondary" @click="submitMessageKey('')">Clear MessageKey</button>
            </div>
        </div>
    </div>
    <div v-if="validator_data !== null && validator_key !== ''" class="py-5 mb-4">
        <h1 class="display-5 fw-bold">Voting Status</h1>
        <div class="container-fluid pb-5">
            <table class="table">
                <thead class="table-dark">
                    <tr>
                        <th>Amendment</th>
                        <th>Flag</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="row in votes" @click="selectedRow(row)" :class="highlights(row)">
                        <td><span class="px-2 py-1">{{ row.label }}</span></td>
                        <td><span :class="(row.flag === 'yay') ? 'bg-green text-light px-2 py-1': 'bg-pink text-light px-2 py-1'">{{ row.flag }}</span></td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
    <div v-else-if="validator_key !== ''">
        <div class="container-fluid mb-5 p-2 bg-light">
            <h3 class="fw-bold text-center">{Waiting for validators data}</h3>
            <p class="text-center" v-if="isLoading">Loading validator..</p>
        </div>
    </div>
    <div v-else-if="validator_key === '' && isLoading === false">
        <h1 class="display-5 fw-bold">Set Validator</h1>
        <input id="register_key" v-model="register_key" placeholder="validaor key" class="mb-2 w-full py-2 border border-indigo-500 rounded" />
        <button v-if="register_key !== ''" type="button" class="btn btn-secondary" @click="assignValidatorKey(register_key)">Set Key</button>
    </div>
    <div v-if="selected_vote.length > 0">
        <p class="ms-2">Cast your vote on your validator for the selected amendments</p>
        <a class="btn btn-green m-2" @click="voteYay" role="button" id="voteYay">Vote Yay</a>
        <a class="btn btn-pink m-2" @click="voteNay" role="button" id="voteNay">Vote Nay</a>
    </div>
    <footer>
        <p class="h1 text-center">{{ledger}}</p>
        <p class="p-3 mb-2 bg-dark text-white">{{account}}</p>
    </footer>
</template>

<script>
    import { Buffer } from 'buffer'
    const xapp = window.xAppSdk

    export default {
        name: 'Landing',
        props: ['client', 'Sdk', 'nodetype'],
        data() {
            return {
                isLoading: true,
                selected_vote: [],
                socket: null,
                validator_key: '',
                validator_data: null,
                votes: [],
                decoded_keys: [],
                client: null,
                set_key: false
            }
        },
        async mounted() {
            console.log('landing mounted...')
            // await this.fetchStorage()
            if (this.$store.getters.getAccount != '') {
                console.log('landing logged in...')
            }

            this.$store.dispatch('clientConnect', false)
            this.client = this.$store.getters.getClient
            await this.connectWebsocket()
            await this.accountInfo()
        },
        computed: {
            ledger() {
                return this.$store.getters.getLedger
            },
            account() {
                return this.$store.getters.getAccount
            }
        },
        watch: {
            async account() {
                if (this.$store.getters.getAccount != '') {
                    console.log('landing fetchData...')
                    await this.fetchData()
                }
            }
        },
        methods: {
            async voteYay() {
                console.log('voteYay', this.selected_vote)
                if (this.decoded_keys[this.validator_key] === undefined) {
                    console.log(`this validators key has not been decoded key ${this.validator_key}`)
                    return
                }
                const Memos =[{
                    Memo: {
                        MemoData: Buffer.from(JSON.stringify({topic: 'amendment', amendment_vote: this.selected_vote, position: false }), 'utf-8').toString('hex').toUpperCase(),
                        MemoFormat: Buffer.from('json', 'utf-8').toString('hex').toUpperCase()
                    }
                }]
                
                const payload = {
                    TransactionType: 'AccountSet',
                    Account: this.$store.getters.getAccount,
                    // MessageKey: this.decoded_keys[this.validator_key],
                    Memos
                }

                console.log('payload', payload)
                this.submitVote({ txjson: payload })
            },
            async voteNay() {
                console.log('voteNay', this.selected_vote)
                if (this.decoded_keys[this.validator_key] === undefined) {
                    console.log(`this validators key has not been decoded key ${this.validator_key}`)
                    return
                }
                const Memos =[{
                    Memo: {
                        MemoData: Buffer.from(JSON.stringify({topic: 'amendment', amendment_vote: this.selected_vote, position: true }), 'utf-8').toString('hex').toUpperCase(),
                        MemoFormat: Buffer.from('json', 'utf-8').toString('hex').toUpperCase()
                    }
                }]
                    
                const payload = {
                    TransactionType: 'AccountSet',
                    Account: this.$store.getters.getAccount,
                    // MessageKey: this.decoded_keys[this.validator_key],
                    Memos
                }

                console.log('payload', payload)
                this.submitVote({ txjson: payload })
            },
            async submitVote(request) {
                // lock it to testnet for testing right now
                const tokenData = this.$store.getters.getXummTokenData
                if (tokenData.nodetype !== 'TESTNET') { return }

                const self = this
                const subscription = await this.Sdk.payload.createAndSubscribe(request, async event => {
                    console.log('New payload event:', event.data)

                    if (event.data.signed === true) {
                        console.log('Woohoo! The sign request was signed :)')
                        return event.data
                    }

                    if (event.data.signed === false) {
                        console.log('The sign request was rejected :(')
                        return false
                    }
                })
                console.log('setSignerList', subscription)

                xapp.openSignRequest({ uuid: subscription.created.uuid })
                    .then(d => {
                        // d (returned value) can be Error or return data:
                        console.log('openSignRequest response:', d instanceof Error ? d.message : d)
                    })
                    .catch(e => console.log('Error:', e.message))
            },
            async submitMessageKey(key) {
                const payload = {
                    TransactionType: 'AccountSet',
                    Account: this.$store.getters.getAccount,
                    MessageKey: key
                }

                // lock it to testnet for testing right now
                const tokenData = this.$store.getters.getXummTokenData
                if (tokenData.nodetype !== 'TESTNET') { return }

                const self = this
                const subscription = await this.Sdk.payload.createAndSubscribe(payload, async event => {
                    console.log('New payload event:', event.data)

                    if (event.data.signed === true) {
                        if (key === '') {
                            self.accountInfo()
                        }
                        console.log('Woohoo! The sign request was signed :)')
                        return event.data
                    }

                    if (event.data.signed === false) {
                        console.log('The sign request was rejected :(')
                        return false
                    }
                })
                console.log('setSignerList', subscription)

                xapp.openSignRequest({ uuid: subscription.created.uuid })
                    .then(d => {
                        // d (returned value) can be Error or return data:
                        console.log('openSignRequest response:', d instanceof Error ? d.message : d)
                    })
                    .catch(e => console.log('Error:', e.message))
            },
            async assignValidatorKey(key) {
                console.log(key)

                await this.waitForOpenConnection(this.socket)
                console.log('sending', {channel: this.$store.getters.getAccount, topic: 'decode-node-public', action: 'set-validator-key', key})
                this.socket.send(JSON.stringify({channel: this.$store.getters.getAccount, topic: 'decode-node-public',  action: 'set-validator-key', key}))
            },
            setValidator(key) {
                // return Buffer.from(codec.decodeNodePublic(key)).toString('hex').toUpperCase()
            },
            highlights(amendment) {
                if (this.selected_vote.includes(amendment.hash)) {
                    return 'table-secondary'
                }
                if (this.selected_vote.includes(amendment.hash)) {
                    return 'table-warning'
                }
                return ''
            },
            selectedRow(amendment) {
                if (!this.selected_vote.includes(amendment.hash)) {
                    this.selected_vote.push(amendment.hash)
                }
                else {
                    this.selected_vote.splice(this.selected_vote.indexOf(amendment.hash), 1)
                }
                console.log('Selected items', this.selected_vote)
            },
            async waitForOpenConnection(socket) {
                return new Promise((resolve, reject) => {
                    const maxNumberOfAttempts = 10
                    const intervalTime = 200 //ms

                    let currentAttempt = 0
                    const interval = setInterval(() => {
                        if (currentAttempt > maxNumberOfAttempts - 1) {
                            clearInterval(interval)
                            reject(new Error('Maximum number of attempts exceeded'))
                        } else if (socket.readyState == 1) {
                            clearInterval(interval)
                            resolve()
                        }
                        currentAttempt++
                    }, intervalTime)
                })
            },
            async connectWebsocket() {
                const self = this
                
                this.socket = new WebSocket('wss://vote-backend.panicbot.xyz')
                console.log('new connection to socket')
                this.reconnect_socket++

                if (this.ping !== undefined) {
                    clearInterval(this.ping)
                }
                
                this.socket.onopen = async function (message) {
                    await self.waitForOpenConnection(self.socket)
                    self.socket.send(JSON.stringify({
                        op: 'subscribe',
                        channel: self.$store.getters.getAccount
                    }))
                    self.ping = setInterval(function() {
                        self.socket.send(JSON.stringify({ op: 'ping' }))
                    }, 5000)
                    console.log('sockets connected! :)')
                }
                this.socket.onmessage = function (message) {
                    // console.log('message', message)
                    if (self.timeout_socket != null) {
                        clearInterval(self.timeout_socket)
                        self.timeout_socket = null
                    }

                    const data  = JSON.parse(message.data)
                    const account = self.$store.getters.getAccount
                    if (data[account] !== undefined) {
                        if ('topic' in data[account]) {
                            if (data[account].topic === 'decode-node-public') {
                                console.log('decode-node-public ...', data)
                                self.decoded_keys[account] = data[account].key

                                if (data[account].action === 'set-validator-key') {
                                    self.submitMessageKey(data[account].key)
                                    self.isLoading = false
                                    self.validator_key = data[account].initial
                                    self.socket.send(JSON.stringify({
                                        op: 'subscribe',
                                        channel: data[account].initial
                                    }))
                                    console.log('subscribed to socket', data[account].initial)
                                }
                            }
                            if (data[account].topic === 'encode-node-public') {
                                console.log('encode-node-public ...', data)
                                if (data[account].action === 'listen-validator') {
                                    self.isLoading = false
                                    self.validator_key = data[account].key
                                    self.socket.send(JSON.stringify({
                                        op: 'subscribe',
                                        channel: data[account].key
                                    }))
                                    console.log('subscribed to socket', data[account].key)
                                }
                            }
                            return
                        }
                    }
                    const validator = self.validator_key //self.$store.getters.getAccount
                    if (data[validator] !== undefined) {
                        self.validator_data = data[validator]
                        // console.log(self.validator_data)
                        self.votes = []
                        for (const [key, value] of Object.entries(self.validator_data.votable_amendments.nay)) {
                            self.votes.push({
                                hash: key,
                                label: value,
                                flag: 'nay'
                            })
                        }
                        for (const [key, value] of Object.entries(self.validator_data.votable_amendments.yay)) {
                            self.votes.push({
                                hash: key,
                                label: value,
                                flag: 'yay'
                            })
                        }
                    }
                }
                this.socket.onerror = function (message) {
                    console.log('There was an error connection to socket! :(', message)
                    self.socket.close()
                }

                this.socket.onclose = function (message) {
                    self.validator_data = null
                    self.selected_vote = []
                    self.votes = []
                    console.log('socket disconnected!', message)
                    if (self.timeout_socket == null && message.code != 1005) {
                        self.timeout_socket = setInterval(async () => {
                            if (self.reconnect_socket < 10) {
                                await self.connectWebsocket() 
                            }
                        }, 4000)
                    }
                }
            },
            ledgerEpoch() {
                const unix_time = Date.now() 
                return Math.floor((unix_time) / 1000) - 946684800
            },
            sortTable(col) {
                if (this.sortColumn === col) {
                    this.ascending = !this.ascending
                } else {
                    this.ascending = true
                    this.sortColumn = col
                }

                let ascending = this.ascending

                this.TokenOffers.sort(function(a, b) {
                    if (a[col] > b[col]) {
                    return ascending ? 1 : -1
                    } else if (a[col] < b[col]) {
                    return ascending ? -1 : 1
                    }
                    return 0
                })
            },
            currencyHexToUTF8(code) {
				if (code.length === 3)
					return code

				let decoded = new TextDecoder()
					.decode(this.hexToBytes(code))
				let padNull = decoded.length

				while (decoded.charAt(padNull - 1) === '\0')
					padNull--

				return decoded.slice(0, padNull)
			},
            hexToBytes(hex) {
				let bytes = new Uint8Array(hex.length / 2)

				for (let i = 0; i !== bytes.length; i++) {
					bytes[i] = parseInt(hex.substr(i * 2, 2), 16)
				}

				return bytes
			},
            async accountInfo() {
                console.log('fetching accountInfo: ' + this.$store.getters.getAccount)
                console.log('this.client', this.client)

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

                if ('MessageKey' in res.account_data) {
                    await this.waitForOpenConnection(this.socket)
                    this.set_key = true
                    console.log('sending', {channel: this.$store.getters.getAccount, topic: 'encode-node-public', action: 'listen-validator', key: res.account_data.MessageKey})
                    this.socket.send(JSON.stringify({channel: this.$store.getters.getAccount, topic: 'encode-node-public',  action: 'listen-validator', key: res.account_data.MessageKey}))
                } else {
                    this.isLoading = false
                }
                
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
        },
    }
</script>
<style scoped>
    .fancy-font {
        font-family: 'Permanent Marker', serif;
    }
    .bg-green {
        background-color: #00e56a;
    }
    .bg-pink {
        background-color: #ff1a8b;
    }
    .bog-roll {
        width: 100%;
    }
    .main-text {
        color: #753ee2;
        -webkit-text-stroke-width: 1px;
        -webkit-text-stroke-color: black;
    }
    .btn-purple {
        background-color: #753ee2;
        color: #ffffff;
    }

    .btn-yellow {
        background-color: #ffc107;
        color: #ffffff;
    }
    .btn-pink {
        background-color: #ff1a8b;
        color: #ffffff;
    }

    .btn-green {
        background-color: #00e56a;
        color: #ffffff;
    }

    .table-warning {
        --bs-table-bg: #f6da86;
        color: #000;
        border-color: #e6dbb9;
    }
</style>
