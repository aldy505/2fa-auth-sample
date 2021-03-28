<template>
  <div class="container mx-auto px-20 py-12 text-center">
    <h1 class="text-4xl font-bold">Please login</h1>
    <section v-if="!submitEmail" :key="submitEmail">
      <form @submit.prevent="submitFormEmail">
        <label for="email" class="block py-2">Enter your email:</label>
        <input type="email" placeholder="somebody@example.com" name="email" v-model="form.email" required class="px-3 py-1 w-full md:w-1/2 lg:w-1/4 border-2 border-black">
        <button type="submit" class="block py-1 px-2 text-white bg-black mx-auto my-2 w-full md:w-1/2 lg:w-1/4">Sign In</button>
        <p class="block py-2 text-red-700" :key="errorMessage">{{ errorMessage }}</p>
      </form>
    </section>
    <section v-else-if="submitEmail" :key="submitEmail">
      <form @submit.prevent="submitFormPassphrase">
        <label for="passphrase" class="block py-2">Enter the passphrase from your mail's inbox:</label>
        <input type="text" name="passphrase" v-model="form.passphrase" required class="px-3 py-1 w-full md:w-1/2 lg:w-1/4 border-2 border-black">
        <button type="submit" class="block py-1 px-2 text-white bg-black mx-auto my-2 w-full md:w-1/2 lg:w-1/4">Confirm</button>
        <p class="block py-2 text-red-700" :key="errorMessage">{{ errorMessage }}</p>
      </form>
    </section>
  </div>
</template>

<script>
import axios from "axios"

export default {
  data() {
    return {
      form: {
        csrf: "",
        email: "",
        passphrase: "",
      },
      submitEmail: false,
      errorMessage: "",
    }
  },
  created() {
    this.fetchCSRFToken()
  },
  methods: {
    async fetchCSRFToken() {
      try {
        const response = await axios.get("http://localhost:3000")
        this.form.csrf = response.data.csrf
      } catch (error) {
        console.error(error)
      }
    },
    async submitFormEmail() {
      try {
        await axios.post(
          'http://localhost:3000/email',
          this.form,
          {
            headers: {
              "XSRF-TOKEN": this.form.csrf
            }
          })
          this.submitEmail = true
          this.fetchCSRFToken()
      } catch (error) {
        this.errorMessage = error.response.data.message
      }
    },
    async submitFormPassphrase() {
      try {
        await axios.post(
          "http://localhost:3000/passphrase",
          this.form,
          {
            headers: {
              "XSRF-TOKEN": this.form.csrf
            }
          })
          this.formReset()
          this.$router.push({ path: "/welcome" })
      } catch (error) {
        this.errorMessage = error.response.data.message
      }
    },
    formReset() {
      this.form = {
        csrf: "",
        email: "",
        passphrase: "",
      }
      this.submitEmail = false
      this.errorMessage = ""
    }
  }
}
</script>

<style>

</style>